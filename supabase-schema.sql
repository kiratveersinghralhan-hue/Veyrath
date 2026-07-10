-- VEYRATH PHASE 2 DATABASE RESET - Razorpay + Printrove
-- WARNING: This reset permanently deletes the VEYRATH public tables listed below.
-- It does not delete Supabase Authentication users.

begin;
create extension if not exists pgcrypto;

drop view if exists public.storefront_products cascade;
drop view if exists public.admin_products cascade;
drop function if exists public.create_pending_order(jsonb,jsonb,text) cascade;
drop function if exists public.create_pending_order(jsonb,jsonb) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.make_order_number() cascade;
drop table if exists public.printrove_order_logs cascade;
drop table if exists public.payment_logs cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.customers cascade;
drop table if exists public.event_logs cascade;
drop table if exists public.newsletter_signups cascade;
drop table if exists public.inquiries cascade;
drop table if exists public.hero_slides cascade;
drop table if exists public.site_settings cascade;
drop table if exists public.products cascade;
drop table if exists public.admin_users cascade;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '',
  category text not null default 'T-Shirts',
  gender text not null default 'Unisex',
  price numeric(12,2) not null default 0 check (price >= 0),
  compare_at_price numeric(12,2) not null default 0 check (compare_at_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  images jsonb not null default '[]'::jsonb,
  image_url text not null default '',
  front_design_url text not null default '',
  back_design_url text not null default '',
  sizes text[] not null default '{}',
  colours text[] not null default '{}',
  tags text[] not null default '{}',
  style text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  printrove_sku text not null default '',
  printrove_product_id text not null default '',
  printrove_variant_id text not null default '',
  printrove_variant_map jsonb not null default '{}'::jsonb,
  printrove_product_type text not null default '',
  print_type text not null default '',
  base_cost numeric(12,2) not null default 0 check (base_cost >= 0),
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  profit_margin numeric(12,2) not null default 0,
  fulfilment_status text not null default 'planned' check (fulfilment_status in ('planned','mapped','ready','paused')),
  external_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  email text not null check (char_length(email) between 3 and 320),
  address_line1 text not null check (char_length(address_line1) between 3 and 240),
  address_line2 text not null default '',
  city text not null check (char_length(city) between 2 and 120),
  state text not null check (char_length(state) between 2 and 120),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  country text not null default 'India',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.make_order_number()
returns text language sql volatile set search_path = public
as $$ select 'VYR-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); $$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.make_order_number(),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10}$'),
  customer_email text not null check (char_length(customer_email) between 3 and 320),
  address_line1 text not null check (char_length(address_line1) between 3 and 240),
  address_line2 text not null default '',
  city text not null check (char_length(city) between 2 and 120),
  state text not null check (char_length(state) between 2 and 120),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  country text not null default 'India',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_amount numeric(12,2) not null default 0 check (shipping_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 1),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  payment_provider text not null default 'razorpay',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  order_status text not null default 'pending_payment' check (order_status in ('pending_payment','payment_verification','payment_failed','paid','processing','fulfilled','cancelled')),
  fulfilment_status text not null default 'not_sent' check (fulfilment_status in ('not_sent','printrove_pending','printrove_created','printrove_failed','fulfilled','cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  printrove_order_id text unique,
  printrove_status text,
  admin_hold boolean not null default false,
  notes text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  size text not null,
  colour text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  printrove_sku text not null default '',
  printrove_product_id text not null default '',
  printrove_variant_id text not null default '',
  front_design_url text not null default '',
  back_design_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  provider text not null default 'razorpay',
  event_type text not null,
  provider_event_id text unique,
  status text not null default 'received',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.printrove_order_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  action text not null,
  status text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hero_slides (
  id uuid primary key default gen_random_uuid(), eyebrow text not null default '', heading text not null,
  body text not null default '', image_url text not null, align text not null default 'left' check (align in ('left','right','center')),
  is_published boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null default '',
  subject text not null default 'Product enquiry', product text not null default '', message text not null,
  status text not null default 'new' check (status in ('new','open','resolved','spam')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.newsletter_signups (
  id uuid primary key default gen_random_uuid(), email text not null unique, source text not null default 'website',
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.event_logs (
  id uuid primary key default gen_random_uuid(), event_name text not null, page_path text not null default '',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_users where user_id = auth.uid() and is_active = true); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger admin_users_updated before update on public.admin_users for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger site_settings_updated before update on public.site_settings for each row execute function public.set_updated_at();
create trigger hero_slides_updated before update on public.hero_slides for each row execute function public.set_updated_at();
create trigger inquiries_updated before update on public.inquiries for each row execute function public.set_updated_at();
create trigger newsletter_updated before update on public.newsletter_signups for each row execute function public.set_updated_at();

-- Creates a complete pending order in one transaction and calculates every price server-side.
create or replace function public.create_pending_order(p_customer jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
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
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then
    raise exception 'Order must contain between 1 and 10 items';
  end if;
  if char_length(v_name) not between 2 and 120 or v_phone !~ '^[0-9]{10}$' or
     char_length(v_email) not between 3 and 320 or position('@' in v_email) < 2 or
     char_length(v_address1) not between 3 and 240 or char_length(v_city) not between 2 and 120 or
     char_length(v_state) not between 2 and 120 or v_pincode !~ '^[1-9][0-9]{5}$' then
    raise exception 'Customer details are incomplete or invalid';
  end if;

  select coalesce((value->>'free_shipping_threshold')::numeric, 1999)
    into v_free_shipping from public.site_settings where key = 'commerce';
  v_free_shipping := coalesce(v_free_shipping, 1999);

  insert into public.customers(id,name,phone,email,address_line1,address_line2,city,state,pincode,country)
  values(v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,'India');

  -- Insert the parent before items; totals are finalized after validated item snapshots exist.
  insert into public.orders(id,order_number,customer_id,customer_name,customer_phone,customer_email,address_line1,address_line2,city,state,pincode,subtotal,shipping_amount,total_amount)
  values(v_order_id,v_order_number,v_customer_id,v_name,v_phone,v_email,v_address1,v_address2,v_city,v_state,v_pincode,0,0,1);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_size := trim(coalesce(v_item->>'size',''));
    v_colour := trim(coalesce(v_item->>'colour',''));
    if v_qty not between 1 and 10 then raise exception 'Invalid quantity'; end if;

    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and is_published = true;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if cardinality(v_product.sizes) > 0 and not (v_size = any(v_product.sizes)) then raise exception 'Invalid size for %', v_product.name; end if;
    if cardinality(v_product.colours) > 0 and not (v_colour = any(v_product.colours)) then raise exception 'Invalid colour for %', v_product.name; end if;

    v_variant := coalesce(nullif(v_product.printrove_variant_map->>(v_colour || '|' || v_size),''), v_product.printrove_variant_id);
    insert into public.order_items(order_id,product_id,product_name,size,colour,quantity,unit_price,total_price,printrove_sku,printrove_product_id,printrove_variant_id,front_design_url,back_design_url)
    values(v_order_id,v_product.id,v_product.name,v_size,v_colour,v_qty,
      coalesce(nullif(v_product.selling_price,0),v_product.price),
      coalesce(nullif(v_product.selling_price,0),v_product.price) * v_qty,
      v_product.printrove_sku,v_product.printrove_product_id,v_variant,v_product.front_design_url,v_product.back_design_url);
    v_subtotal := v_subtotal + coalesce(nullif(v_product.selling_price,0),v_product.price) * v_qty;
    v_shipping := greatest(v_shipping, v_product.shipping_cost);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 or v_subtotal < 1 then raise exception 'Order total is invalid'; end if;
  if v_subtotal >= v_free_shipping then v_shipping := 0; end if;
  update public.orders set subtotal=v_subtotal,shipping_amount=v_shipping,total_amount=v_subtotal+v_shipping where id=v_order_id;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_amount',v_shipping,'total_amount',v_subtotal+v_shipping,'currency','INR');
end $$;
revoke all on function public.create_pending_order(jsonb,jsonb) from public;
grant execute on function public.create_pending_order(jsonb,jsonb) to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_logs enable row level security;
alter table public.printrove_order_logs enable row level security;
alter table public.site_settings enable row level security;
alter table public.hero_slides enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_signups enable row level security;
alter table public.event_logs enable row level security;

create policy "Published product rows are visible" on public.products for select to anon,authenticated using (is_published or public.is_admin());
create policy "Admins create products" on public.products for insert to authenticated with check (public.is_admin());
create policy "Admins update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete products" on public.products for delete to authenticated using (public.is_admin());

create policy "Public creates customers" on public.customers for insert to anon,authenticated with check (true);
create policy "Admins read customers" on public.customers for select to authenticated using (public.is_admin());

create policy "Public creates pending orders" on public.orders for insert to anon,authenticated with check (
  payment_status='pending' and order_status='pending_payment' and fulfilment_status='not_sent' and
  razorpay_order_id is null and razorpay_payment_id is null and printrove_order_id is null and admin_hold=false
);
create policy "Admins read orders" on public.orders for select to authenticated using (public.is_admin());
create policy "Admins update order notes and hold" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public creates pending order items" on public.order_items for insert to anon,authenticated with check (true);
create policy "Admins read order items" on public.order_items for select to authenticated using (public.is_admin());
create policy "Admins read payment logs" on public.payment_logs for select to authenticated using (public.is_admin());
create policy "Admins read Printrove logs" on public.printrove_order_logs for select to authenticated using (public.is_admin());

create policy "Public reads public settings" on public.site_settings for select to anon,authenticated using (is_public or public.is_admin());
create policy "Admins manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public reads published slides" on public.hero_slides for select to anon,authenticated using (is_published or public.is_admin());
create policy "Admins manage slides" on public.hero_slides for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public creates inquiries" on public.inquiries for insert to anon,authenticated with check (char_length(name) between 2 and 120 and char_length(email) between 3 and 320 and char_length(message) between 1 and 5000);
create policy "Admins manage inquiries" on public.inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public joins newsletter" on public.newsletter_signups for insert to anon,authenticated with check (char_length(email) between 3 and 320);
create policy "Admins manage newsletter" on public.newsletter_signups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public creates events" on public.event_logs for insert to anon,authenticated with check (char_length(event_name) between 1 and 100);
create policy "Admins read events" on public.event_logs for select to authenticated using (public.is_admin());
create policy "Admin reads own access" on public.admin_users for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "Admins manage access" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public view deliberately excludes costs, profit and fulfilment credentials.
create view public.storefront_products with (security_invoker=true) as
select id,slug,name,description,category,gender,coalesce(nullif(selling_price,0),price) as price,
  compare_at_price,currency,images,image_url,front_design_url,back_design_url,sizes,colours,tags,style,rating,
  is_published,is_featured,sort_order,shipping_cost,fulfilment_status,created_at,updated_at
from public.products where is_published=true;

create view public.admin_products with (security_invoker=true) as
select p.* from public.products p where public.is_admin();

grant usage on schema public to anon,authenticated;
grant select(id,slug,name,description,category,gender,price,compare_at_price,selling_price,currency,images,image_url,front_design_url,back_design_url,sizes,colours,tags,style,rating,is_published,is_featured,sort_order,shipping_cost,fulfilment_status,created_at,updated_at) on public.products to anon,authenticated;
grant select on public.storefront_products,public.site_settings,public.hero_slides to anon,authenticated;
grant select on public.admin_products to authenticated;
grant insert on public.customers,public.orders,public.order_items,public.inquiries,public.newsletter_signups,public.event_logs to anon,authenticated;
grant insert,update,delete on public.products to authenticated;
grant select,insert,update,delete on public.site_settings,public.hero_slides,public.inquiries,public.newsletter_signups,public.event_logs,public.admin_users to authenticated;
grant select on public.customers,public.orders,public.order_items,public.payment_logs,public.printrove_order_logs to authenticated;
revoke update on public.orders from anon,authenticated;
grant update(admin_hold,notes) on public.orders to authenticated;
grant all on public.admin_users,public.products,public.customers,public.orders,public.order_items,public.payment_logs,public.printrove_order_logs,public.site_settings,public.hero_slides,public.inquiries,public.newsletter_signups,public.event_logs to service_role;

insert into public.site_settings(key,value,is_public) values
('commerce','{"auto_send_to_printrove":false,"free_shipping_threshold":1999,"default_currency":"INR"}'::jsonb,true),
('site_data', $json$
{
  "hero":{"eyebrow":"VEYRATH / BORN AFTER DARK","heading":"Own every. silent. move.","subheading":"Oversized streetwear for the ones who never need to announce themselves.","primary_label":"Shop collection","primary_link":"shop.html","secondary_label":"Join inner circle","secondary_link":"#inner-circle","image_url":"veyrath-hero.jpg"},
  "about_text":"VEYRATH is made for the ones who move in silence. Every piece blends oversized streetwear, subtle astrology details, and dark luxury energy - designed to feel powerful without being loud.",
  "marquee_text":"BORN AFTER DARK - OVERSIZED FIRST - BUILT IN INDIA - MADE AFTER ORDER - SILENT AMBITION -",
  "offers":[{"kicker":"FIRST SIGNAL","text":"10% OFF WITH CODE AFTERDARK10"},{"kicker":"FREE SHIPPING","text":"ON ORDERS ABOVE INR 1,999"},{"kicker":"INNER CIRCLE","text":"EARLY ACCESS TO EVERY DROP"}],
  "category_intro":"Essential forms, cut with intention. Start with oversized tees and move deeper after dark.",
  "categories":[{"name":"Oversized T-Shirts","image":"veyrath-tee.jpg","query":"T-Shirts","note":"Heavyweight. Relaxed. Unapologetic."},{"name":"Hoodies","image":"veyrath-hoodies.jpg","query":"Hoodies","note":"Built for the hours after midnight."},{"name":"Lowers","image":"veyrath-hoodies.jpg","query":"Lowers","note":"Quiet comfort with deliberate volume."},{"name":"Accessories","image":"veyrath-accessories.jpg","query":"Accessories","note":"Small signals. Lasting orbit."}]
}
$json$::jsonb,true);

insert into public.hero_slides(eyebrow,heading,body,image_url,align,sort_order) values
('Campaign 001','Silence has a silhouette.','Heavyweight black. Deliberate volume. A signal without noise.','veyrath-carousel-01.jpg','right',1),
('Campaign 002','Enter the orbit.','An original celestial system, drawn for the hours after dark.','veyrath-carousel-02.jpg','left',2),
('Campaign 003','Two forms. One frequency.','The VEYRATH uniform moves differently on everyone.','veyrath-carousel-03.jpg','center',3);

insert into public.admin_users(user_id,email,is_active)
select id,email,true from auth.users where lower(email)='kiratveersinghralhan@gmail.com'
on conflict(user_id) do update set email=excluded.email,is_active=true;

create index products_public_idx on public.products(is_published,sort_order desc);
create index orders_created_idx on public.orders(created_at desc);
create index orders_payment_idx on public.orders(payment_status,created_at desc);
create index orders_fulfilment_idx on public.orders(fulfilment_status,created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index payment_logs_order_idx on public.payment_logs(order_id,created_at desc);
create index printrove_logs_order_idx on public.printrove_order_logs(order_id,created_at desc);

-- Public product-gallery files. Only active admins may upload, replace or delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public reads VEYRATH product images" on storage.objects;
drop policy if exists "Admins upload VEYRATH product images" on storage.objects;
drop policy if exists "Admins update VEYRATH product images" on storage.objects;
drop policy if exists "Admins delete VEYRATH product images" on storage.objects;
create policy "Public reads VEYRATH product images" on storage.objects for select to anon,authenticated using(bucket_id='product-images');
create policy "Admins upload VEYRATH product images" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
create policy "Admins update VEYRATH product images" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
create policy "Admins delete VEYRATH product images" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());

commit;

-- If the Auth user is created after this reset, run admin-access.sql once.
