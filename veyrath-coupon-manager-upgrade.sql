-- VEYRATH coupon manager upgrade (NON-DESTRUCTIVE)
-- Run this AFTER veyrath-launch-upgrade.sql in the live VEYRATH Supabase project.
-- It keeps every existing product, order, coupon and customer.

begin;

do $$ begin
  if to_regclass('public.coupons') is null then
    raise exception 'Run veyrath-launch-upgrade.sql first. It creates the secure coupons table.';
  end if;
end $$;

alter table public.coupons
  add column if not exists scope text not null default 'order' check (scope in ('order','product')),
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists is_public boolean not null default true,
  add column if not exists customer_email text,
  add column if not exists auto_apply boolean not null default false;

alter table public.coupons drop constraint if exists coupons_scope_product_check;
alter table public.coupons add constraint coupons_scope_product_check
  check ((scope = 'order' and product_id is null) or (scope = 'product' and product_id is not null));
alter table public.coupons drop constraint if exists coupons_percentage_range_check;
alter table public.coupons add constraint coupons_percentage_range_check
  check (discount_type <> 'percentage' or discount_value <= 100);

create index if not exists coupons_live_lookup_idx on public.coupons (code, is_active, is_public);
create index if not exists coupons_product_offer_idx on public.coupons (product_id) where is_active and is_public;

-- This view deliberately exposes only public promotion fields. Personal coupon email targets stay private.
drop view if exists public.public_coupon_offers;
create view public.public_coupon_offers as
select id, code, label, discount_type, discount_value, minimum_order_amount, scope, product_id, auto_apply, starts_at, ends_at, created_at
from public.coupons
where is_active = true
  and is_public = true
  and coalesce(customer_email, '') = ''
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and (usage_limit is null or used_count < usage_limit);
grant select on public.public_coupon_offers to anon, authenticated;

-- Validates one code for its target product and, where applicable, its assigned customer email.
create or replace function public.validate_coupon_for_checkout(
  p_code text,
  p_subtotal numeric,
  p_product_ids jsonb,
  p_email text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_coupon public.coupons%rowtype;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_discount numeric(12,2);
  v_matches_product boolean := false;
begin
  if v_code !~ '^[A-Z0-9_-]{3,40}$' or coalesce(p_subtotal, 0) < 1 then
    return jsonb_build_object('valid', false, 'message', 'That code is not available.');
  end if;
  if jsonb_typeof(coalesce(p_product_ids, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('valid', false, 'message', 'Could not verify the selected piece.');
  end if;
  select * into v_coupon from public.coupons
  where code = v_code and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and (usage_limit is null or used_count < usage_limit);
  if not found then return jsonb_build_object('valid', false, 'message', 'That code is not available.'); end if;
  if not v_coupon.is_public and coalesce(v_coupon.customer_email, '') = '' then
    return jsonb_build_object('valid', false, 'message', 'This is a private code.');
  end if;
  if coalesce(v_coupon.customer_email, '') <> '' and lower(v_coupon.customer_email) <> v_email then
    return jsonb_build_object('valid', false, 'message', 'This code is assigned to a different email.');
  end if;
  if v_coupon.scope = 'product' then
    select exists(select 1 from jsonb_array_elements_text(p_product_ids) as value where value::uuid = v_coupon.product_id) into v_matches_product;
    if not v_matches_product then return jsonb_build_object('valid', false, 'message', 'This code is not for the selected piece.'); end if;
  end if;
  if p_subtotal < v_coupon.minimum_order_amount then
    return jsonb_build_object('valid', false, 'message', format('This code starts at INR %s.', trim(to_char(v_coupon.minimum_order_amount, 'FM999999990.00'))));
  end if;
  v_discount := case when v_coupon.discount_type = 'percentage' then round(p_subtotal * v_coupon.discount_value / 100, 2) else least(p_subtotal, v_coupon.discount_value) end;
  return jsonb_build_object('valid', true, 'code', v_coupon.code, 'label', v_coupon.label,
    'discount_type', v_coupon.discount_type, 'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount, 'scope', v_coupon.scope, 'product_id', v_coupon.product_id,
    'auto_apply', v_coupon.auto_apply);
end $$;
revoke all on function public.validate_coupon_for_checkout(text,numeric,jsonb,text) from public;
grant execute on function public.validate_coupon_for_checkout(text,numeric,jsonb,text) to anon, authenticated;

-- Keep the existing two-argument order RPC and recheck coupon targeting securely before Razorpay is opened.
create or replace function public.create_pending_order(p_customer jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid := gen_random_uuid(); v_customer_id uuid := gen_random_uuid(); v_order_number text := public.make_order_number();
  v_item jsonb; v_product public.products%rowtype; v_qty integer; v_size text; v_colour text; v_variant text;
  v_subtotal numeric(12,2) := 0; v_shipping numeric(12,2) := 0; v_discount numeric(12,2) := 0; v_total numeric(12,2); v_free_shipping numeric(12,2) := 1999; v_count integer := 0;
  v_name text := trim(coalesce(p_customer->>'name','')); v_phone text := regexp_replace(coalesce(p_customer->>'phone',''), '\D', '', 'g'); v_email text := lower(trim(coalesce(p_customer->>'email','')));
  v_address1 text := trim(coalesce(p_customer->>'address_line1','')); v_address2 text := trim(coalesce(p_customer->>'address_line2','')); v_city text := trim(coalesce(p_customer->>'city','')); v_state text := trim(coalesce(p_customer->>'state','')); v_pincode text := trim(coalesce(p_customer->>'pincode',''));
  v_coupon_code text := upper(trim(coalesce(p_customer->>'coupon_code',''))); v_coupon jsonb; v_product_ids jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then raise exception 'Order must contain between 1 and 10 items'; end if;
  if char_length(v_name) not between 2 and 120 or v_phone !~ '^[0-9]{10}$' or char_length(v_email) not between 3 and 320 or position('@' in v_email) < 2 or char_length(v_address1) not between 3 and 240 or char_length(v_city) not between 2 and 120 or char_length(v_state) not between 2 and 120 or v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'Customer details are incomplete or invalid'; end if;
  select coalesce((value->>'free_shipping_threshold')::numeric, 1999) into v_free_shipping from public.site_settings where key = 'commerce'; v_free_shipping := coalesce(v_free_shipping, 1999);
  insert into public.customers(id,name,phone,email,address_line1,address_line2,city,state,pincode,country) values(v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,'India');
  insert into public.orders(id,order_number,customer_id,customer_name,customer_phone,customer_email,address_line1,address_line2,city,state,pincode,subtotal,shipping_amount,total_amount,coupon_code,discount_amount) values(v_order_id,v_order_number,v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,0,0,1,null,0);
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0); v_size := trim(coalesce(v_item->>'size','')); v_colour := trim(coalesce(v_item->>'colour',''));
    if v_qty not between 1 and 10 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_published=true;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if cardinality(v_product.sizes)>0 and not(v_size=any(v_product.sizes)) then raise exception 'Invalid size for %',v_product.name; end if;
    if cardinality(v_product.colours)>0 and not(v_colour=any(v_product.colours)) then raise exception 'Invalid colour for %',v_product.name; end if;
    v_variant := coalesce(nullif(v_product.printrove_variant_map->>(v_colour||'|'||v_size),''),v_product.printrove_variant_id);
    insert into public.order_items(order_id,product_id,product_name,size,colour,quantity,unit_price,total_price,printrove_sku,printrove_product_id,printrove_variant_id,front_design_url,back_design_url) values(v_order_id,v_product.id,v_product.name,v_size,v_colour,v_qty,coalesce(nullif(v_product.selling_price,0),v_product.price),coalesce(nullif(v_product.selling_price,0),v_product.price)*v_qty,v_product.printrove_sku,v_product.printrove_product_id,v_variant,v_product.front_design_url,v_product.back_design_url);
    v_subtotal:=v_subtotal+coalesce(nullif(v_product.selling_price,0),v_product.price)*v_qty; v_shipping:=greatest(v_shipping,v_product.shipping_cost); v_product_ids:=v_product_ids || jsonb_build_array(v_product.id); v_count:=v_count+1;
  end loop;
  if v_count=0 or v_subtotal<1 then raise exception 'Order total is invalid'; end if;
  if v_subtotal>=v_free_shipping then v_shipping:=0; end if;
  if v_coupon_code<>'' then v_coupon:=public.validate_coupon_for_checkout(v_coupon_code,v_subtotal,v_product_ids,v_email); if coalesce((v_coupon->>'valid')::boolean,false) is not true then raise exception '%',coalesce(v_coupon->>'message','That code is not available.'); end if; v_discount:=(v_coupon->>'discount_amount')::numeric; else v_coupon_code:=null; end if;
  v_total:=v_subtotal+v_shipping-v_discount; if v_total<1 then raise exception 'Discount cannot reduce the payable total below INR 1'; end if;
  update public.orders set subtotal=v_subtotal,shipping_amount=v_shipping,discount_amount=v_discount,coupon_code=v_coupon_code,total_amount=v_total where id=v_order_id;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_amount',v_shipping,'discount_amount',v_discount,'coupon_code',v_coupon_code,'total_amount',v_total,'currency','INR');
end $$;
revoke all on function public.create_pending_order(jsonb,jsonb) from public;
grant execute on function public.create_pending_order(jsonb,jsonb) to anon, authenticated;

insert into public.coupons(code,label,discount_type,discount_value,minimum_order_amount,is_active,scope,is_public,auto_apply)
values ('LAUNCH20','Launch offer: 20% off','percentage',20,0,true,'order',true,true)
on conflict (code) do update set label=excluded.label, discount_type=excluded.discount_type, discount_value=excluded.discount_value, is_active=true, scope='order', product_id=null, is_public=true, customer_email=null, auto_apply=true, updated_at=now();

-- The earlier package seeded this fallback. Pause it only when it is still untouched so visitors see one clear launch offer.
update public.coupons
set is_active = false, updated_at = now()
where code = 'AFTERDARK10'
  and label = 'First signal: 10% off'
  and discount_type = 'percentage'
  and discount_value = 10;

commit;

select 'VEYRATH coupon manager installed.' as status,
  (select count(*) from public.coupons) as coupons_ready,
  (select count(*) from public.coupons where is_active and is_public) as public_offers;
