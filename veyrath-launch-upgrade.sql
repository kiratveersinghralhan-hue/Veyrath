-- VEYRATH launch upgrade (NON-DESTRUCTIVE)
-- Run this once in the SQL Editor of the live VEYRATH Supabase project.
-- It keeps all existing products, customers, orders, collections and settings.

begin;

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column if not exists coupon_redeemed_at timestamptz,
  add column if not exists courier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at timestamptz;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 40),
  label text not null default '',
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.order_notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('payment_confirmed','tracking_available')),
  recipient_email text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','skipped','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

drop trigger if exists coupons_updated on public.coupons;
create trigger coupons_updated before update on public.coupons for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;
alter table public.order_notification_logs enable row level security;

drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins read order notification logs" on public.order_notification_logs;
create policy "Admins read order notification logs" on public.order_notification_logs for select to authenticated
  using (public.is_admin());

grant select,insert,update,delete on public.coupons to authenticated;
grant select on public.order_notification_logs to authenticated;
grant update (admin_hold, notes, courier_name, tracking_number, tracking_url, dispatched_at, delivered_at, order_status, fulfilment_status)
  on public.orders to authenticated;

-- Public validation returns no coupon internals other than the exact valid offer.
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_coupon public.coupons%rowtype;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_discount numeric(12,2);
begin
  if v_code !~ '^[A-Z0-9_-]{3,40}$' or coalesce(p_subtotal, 0) < 1 then
    return jsonb_build_object('valid', false, 'message', 'That code is not available.');
  end if;
  select * into v_coupon from public.coupons
  where code = v_code and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and (usage_limit is null or used_count < usage_limit);
  if not found then return jsonb_build_object('valid', false, 'message', 'That code is not available.'); end if;
  if p_subtotal < v_coupon.minimum_order_amount then
    return jsonb_build_object('valid', false, 'message', format('This code starts at ₹%s.', trim(to_char(v_coupon.minimum_order_amount, 'FM999999990.00'))));
  end if;
  v_discount := case when v_coupon.discount_type = 'percentage'
    then round(p_subtotal * v_coupon.discount_value / 100, 2)
    else least(p_subtotal, v_coupon.discount_value) end;
  return jsonb_build_object('valid', true, 'code', v_coupon.code, 'label', v_coupon.label,
    'discount_type', v_coupon.discount_type, 'discount_value', v_coupon.discount_value, 'discount_amount', v_discount);
end $$;
revoke all on function public.validate_coupon(text,numeric) from public;
grant execute on function public.validate_coupon(text,numeric) to anon, authenticated;

-- Exactly two parameters: this replaces the previous function and prevents RPC overload ambiguity.
create or replace function public.create_pending_order(p_customer jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_order_number text := public.make_order_number();
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_size text;
  v_colour text;
  v_variant text;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_free_shipping numeric(12,2) := 1999;
  v_count integer := 0;
  v_name text := trim(coalesce(p_customer->>'name',''));
  v_phone text := regexp_replace(coalesce(p_customer->>'phone',''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_customer->>'email','')));
  v_address1 text := trim(coalesce(p_customer->>'address_line1',''));
  v_address2 text := trim(coalesce(p_customer->>'address_line2',''));
  v_city text := trim(coalesce(p_customer->>'city',''));
  v_state text := trim(coalesce(p_customer->>'state',''));
  v_pincode text := trim(coalesce(p_customer->>'pincode',''));
  v_coupon_code text := upper(trim(coalesce(p_customer->>'coupon_code','')));
  v_coupon jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then raise exception 'Order must contain between 1 and 10 items'; end if;
  if char_length(v_name) not between 2 and 120 or v_phone !~ '^[0-9]{10}$' or char_length(v_email) not between 3 and 320 or position('@' in v_email) < 2
    or char_length(v_address1) not between 3 and 240 or char_length(v_city) not between 2 and 120 or char_length(v_state) not between 2 and 120 or v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'Customer details are incomplete or invalid'; end if;

  select coalesce((value->>'free_shipping_threshold')::numeric, 1999) into v_free_shipping from public.site_settings where key = 'commerce';
  v_free_shipping := coalesce(v_free_shipping, 1999);
  insert into public.customers(id,name,phone,email,address_line1,address_line2,city,state,pincode,country) values(v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,'India');
  insert into public.orders(id,order_number,customer_id,customer_name,customer_phone,customer_email,address_line1,address_line2,city,state,pincode,subtotal,shipping_amount,total_amount,coupon_code,discount_amount)
    values(v_order_id,v_order_number,v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,0,0,1,null,0);

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0); v_size := trim(coalesce(v_item->>'size','')); v_colour := trim(coalesce(v_item->>'colour',''));
    if v_qty not between 1 and 10 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and is_published = true;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if cardinality(v_product.sizes) > 0 and not (v_size = any(v_product.sizes)) then raise exception 'Invalid size for %', v_product.name; end if;
    if cardinality(v_product.colours) > 0 and not (v_colour = any(v_product.colours)) then raise exception 'Invalid colour for %', v_product.name; end if;
    v_variant := coalesce(nullif(v_product.printrove_variant_map->>(v_colour || '|' || v_size),''), v_product.printrove_variant_id);
    insert into public.order_items(order_id,product_id,product_name,size,colour,quantity,unit_price,total_price,printrove_sku,printrove_product_id,printrove_variant_id,front_design_url,back_design_url)
      values(v_order_id,v_product.id,v_product.name,v_size,v_colour,v_qty,coalesce(nullif(v_product.selling_price,0),v_product.price),coalesce(nullif(v_product.selling_price,0),v_product.price)*v_qty,v_product.printrove_sku,v_product.printrove_product_id,v_variant,v_product.front_design_url,v_product.back_design_url);
    v_subtotal := v_subtotal + coalesce(nullif(v_product.selling_price,0),v_product.price)*v_qty; v_shipping := greatest(v_shipping,v_product.shipping_cost); v_count := v_count + 1;
  end loop;
  if v_count = 0 or v_subtotal < 1 then raise exception 'Order total is invalid'; end if;
  if v_subtotal >= v_free_shipping then v_shipping := 0; end if;
  if v_coupon_code <> '' then
    v_coupon := public.validate_coupon(v_coupon_code, v_subtotal);
    if coalesce((v_coupon->>'valid')::boolean, false) is not true then raise exception '%', coalesce(v_coupon->>'message','That code is not available.'); end if;
    v_discount := (v_coupon->>'discount_amount')::numeric;
  else v_coupon_code := null; end if;
  v_total := v_subtotal + v_shipping - v_discount;
  if v_total < 1 then raise exception 'Discount cannot reduce the payable total below ₹1'; end if;
  update public.orders set subtotal=v_subtotal,shipping_amount=v_shipping,discount_amount=v_discount,coupon_code=v_coupon_code,total_amount=v_total where id=v_order_id;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_amount',v_shipping,'discount_amount',v_discount,'coupon_code',v_coupon_code,'total_amount',v_total,'currency','INR');
end $$;
revoke all on function public.create_pending_order(jsonb,jsonb) from public;
grant execute on function public.create_pending_order(jsonb,jsonb) to anon, authenticated;

create or replace function public.redeem_coupon_for_paid_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select coupon_code into v_code from public.orders where id=p_order_id and payment_status='paid' and coupon_redeemed_at is null for update;
  if v_code is null or v_code = '' then return; end if;
  update public.coupons set used_count=used_count+1 where code=v_code and is_active=true and (usage_limit is null or used_count < usage_limit);
  if found then update public.orders set coupon_redeemed_at=now() where id=p_order_id; end if;
end $$;
revoke all on function public.redeem_coupon_for_paid_order(uuid) from public;
grant execute on function public.redeem_coupon_for_paid_order(uuid) to service_role;

-- Public status lookup needs the order number plus the same customer email. It never returns delivery address or payment IDs.
create or replace function public.track_order(p_order_number text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_status text; v_message text;
begin
  select * into v_order from public.orders where upper(order_number)=upper(trim(coalesce(p_order_number,''))) and lower(customer_email)=lower(trim(coalesce(p_email,'')));
  if not found then return jsonb_build_object('found',false); end if;
  v_status := case when v_order.delivered_at is not null or v_order.order_status='fulfilled' then 'Delivered'
    when coalesce(v_order.tracking_number,'')<>'' then 'Dispatched'
    when v_order.payment_status='paid' then 'Preparing your piece'
    when v_order.payment_status='failed' then 'Payment needs attention' else 'Awaiting payment' end;
  v_message := case when v_status='Delivered' then 'Delivered — we hope it has found its place after dark.'
    when v_status='Dispatched' then 'Your piece is with the courier. Tracking is ready below.'
    when v_status='Preparing your piece' then 'Payment is confirmed. Your piece is being prepared.'
    when v_status='Payment needs attention' then 'This payment was not completed. Please contact support if you need help.'
    else 'This order is waiting for payment confirmation.' end;
  return jsonb_build_object('found',true,'order_number',v_order.order_number,'order_status',v_order.order_status,'status',v_status,'display_status',v_message,'message',v_message,'courier_name',coalesce(v_order.courier_name,''),'courier',coalesce(v_order.courier_name,''),'tracking_number',coalesce(v_order.tracking_number,''),'tracking_url',coalesce(v_order.tracking_url,''),'updated_at',v_order.updated_at);
end $$;
revoke all on function public.track_order(text,text) from public;
grant execute on function public.track_order(text,text) to anon, authenticated;

insert into public.coupons(code,label,discount_type,discount_value,minimum_order_amount,is_active)
values ('AFTERDARK10','First signal: 10% off','percentage',10,0,true)
on conflict (code) do nothing;

commit;

select 'VEYRATH launch upgrade installed; existing products and orders were kept.' as status,
  (select count(*) from public.products) as existing_products_kept,
  (select count(*) from public.coupons) as coupons_ready;
