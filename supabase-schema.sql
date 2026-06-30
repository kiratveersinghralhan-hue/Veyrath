-- VEYRATH Supabase schema
-- Safe to run more than once. Uses only the public anon/authenticated roles and RLS.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text,
  description text default '',
  price numeric(12,2) not null default 0,
  sale_price numeric(12,2),
  category text not null default 'T-Shirts',
  gender text not null default 'Unisex',
  rating numeric(2,1) default 0,
  colours text[] not null default '{}',
  sizes text[] not null default '{}',
  style text default '',
  image_url text default '',
  front_image_url text default '',
  back_image_url text default '',
  blinkstore_url text default '',
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists name text;
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists description text default '';
alter table public.products add column if not exists price numeric(12,2) default 0;
alter table public.products add column if not exists sale_price numeric(12,2);
alter table public.products add column if not exists category text default 'T-Shirts';
alter table public.products add column if not exists gender text default 'Unisex';
alter table public.products add column if not exists rating numeric(2,1) default 0;
alter table public.products add column if not exists colours text[] default '{}';
alter table public.products add column if not exists sizes text[] default '{}';
alter table public.products add column if not exists style text default '';
alter table public.products add column if not exists image_url text default '';
alter table public.products add column if not exists front_image_url text default '';
alter table public.products add column if not exists back_image_url text default '';
alter table public.products add column if not exists blinkstore_url text default '';
alter table public.products add column if not exists is_published boolean not null default false;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_slug_unique on public.products (slug) where slug is not null;
create index if not exists products_published_order_idx on public.products (is_published, sort_order);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_settings add column if not exists value jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists is_public boolean not null default true;
alter table public.site_settings add column if not exists created_at timestamptz not null default now();
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.hero_slides (
  id text primary key default gen_random_uuid()::text,
  eyebrow text default '',
  title text not null,
  text text default '',
  cta_label text default '',
  cta_link text default '',
  media_url text default '',
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hero_slides add column if not exists eyebrow text default '';
alter table public.hero_slides add column if not exists title text;
alter table public.hero_slides add column if not exists text text default '';
alter table public.hero_slides add column if not exists cta_label text default '';
alter table public.hero_slides add column if not exists cta_link text default '';
alter table public.hero_slides add column if not exists media_url text default '';
alter table public.hero_slides add column if not exists is_published boolean not null default false;
alter table public.hero_slides add column if not exists sort_order integer not null default 0;
alter table public.hero_slides add column if not exists created_at timestamptz not null default now();
alter table public.hero_slides add column if not exists updated_at timestamptz not null default now();
create index if not exists hero_slides_published_order_idx on public.hero_slides (is_published, sort_order);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text default 'General inquiry',
  product text default '',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inquiries add column if not exists name text;
alter table public.inquiries add column if not exists email text;
alter table public.inquiries add column if not exists subject text default 'General inquiry';
alter table public.inquiries add column if not exists product text default '';
alter table public.inquiries add column if not exists message text;
alter table public.inquiries add column if not exists status text not null default 'new';
alter table public.inquiries add column if not exists created_at timestamptz not null default now();
alter table public.inquiries add column if not exists updated_at timestamptz not null default now();
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);

create table if not exists public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'website',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.newsletter_signups add column if not exists email text;
alter table public.newsletter_signups add column if not exists source text default 'website';
alter table public.newsletter_signups add column if not exists is_active boolean not null default true;
alter table public.newsletter_signups add column if not exists created_at timestamptz not null default now();
alter table public.newsletter_signups add column if not exists updated_at timestamptz not null default now();
create unique index if not exists newsletter_email_unique on public.newsletter_signups (email);

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  page_path text default '',
  metadata jsonb not null default '{}'::jsonb,
  session_id text default '',
  created_at timestamptz not null default now()
);
alter table public.event_logs add column if not exists event_name text;
alter table public.event_logs add column if not exists page_path text default '';
alter table public.event_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.event_logs add column if not exists session_id text default '';
alter table public.event_logs add column if not exists created_at timestamptz not null default now();
create index if not exists event_logs_created_idx on public.event_logs (created_at desc);
create index if not exists event_logs_name_idx on public.event_logs (event_name);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists is_active boolean not null default true;
alter table public.admin_users add column if not exists created_at timestamptz not null default now();
alter table public.admin_users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists admin_users_email_unique on public.admin_users (lower(email));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
drop trigger if exists hero_slides_set_updated_at on public.hero_slides;
create trigger hero_slides_set_updated_at before update on public.hero_slides for each row execute function public.set_updated_at();
drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at before update on public.inquiries for each row execute function public.set_updated_at();
drop trigger if exists newsletter_set_updated_at on public.newsletter_signups;
create trigger newsletter_set_updated_at before update on public.newsletter_signups for each row execute function public.set_updated_at();
drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at before update on public.admin_users for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.hero_slides enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_signups enable row level security;
alter table public.event_logs enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public reads published products" on public.products;
create policy "Public reads published products" on public.products for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "Public reads public settings" on public.site_settings;
create policy "Public reads public settings" on public.site_settings for select to anon, authenticated using (is_public = true or public.is_admin());
drop policy if exists "Admins insert settings" on public.site_settings;
create policy "Admins insert settings" on public.site_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update settings" on public.site_settings;
create policy "Admins update settings" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete settings" on public.site_settings;
create policy "Admins delete settings" on public.site_settings for delete to authenticated using (public.is_admin());

drop policy if exists "Public reads published slides" on public.hero_slides;
create policy "Public reads published slides" on public.hero_slides for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists "Admins insert slides" on public.hero_slides;
create policy "Admins insert slides" on public.hero_slides for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update slides" on public.hero_slides;
create policy "Admins update slides" on public.hero_slides for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete slides" on public.hero_slides;
create policy "Admins delete slides" on public.hero_slides for delete to authenticated using (public.is_admin());

drop policy if exists "Public creates inquiries" on public.inquiries;
create policy "Public creates inquiries" on public.inquiries for insert to anon, authenticated with check (char_length(email) between 3 and 320 and char_length(message) between 1 and 10000);
drop policy if exists "Admins read inquiries" on public.inquiries;
create policy "Admins read inquiries" on public.inquiries for select to authenticated using (public.is_admin());
drop policy if exists "Admins update inquiries" on public.inquiries;
create policy "Admins update inquiries" on public.inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete inquiries" on public.inquiries;
create policy "Admins delete inquiries" on public.inquiries for delete to authenticated using (public.is_admin());

drop policy if exists "Public joins newsletter" on public.newsletter_signups;
create policy "Public joins newsletter" on public.newsletter_signups for insert to anon, authenticated with check (char_length(email) between 3 and 320);
drop policy if exists "Admins read newsletter" on public.newsletter_signups;
create policy "Admins read newsletter" on public.newsletter_signups for select to authenticated using (public.is_admin());
drop policy if exists "Admins update newsletter" on public.newsletter_signups;
create policy "Admins update newsletter" on public.newsletter_signups for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete newsletter" on public.newsletter_signups;
create policy "Admins delete newsletter" on public.newsletter_signups for delete to authenticated using (public.is_admin());

drop policy if exists "Public creates event logs" on public.event_logs;
create policy "Public creates event logs" on public.event_logs for insert to anon, authenticated with check (char_length(event_name) between 1 and 120);
drop policy if exists "Admins read event logs" on public.event_logs;
create policy "Admins read event logs" on public.event_logs for select to authenticated using (public.is_admin());
drop policy if exists "Admins delete event logs" on public.event_logs;
create policy "Admins delete event logs" on public.event_logs for delete to authenticated using (public.is_admin());

drop policy if exists "Admins read admin list" on public.admin_users;
create policy "Admins read admin list" on public.admin_users for select to authenticated using (public.is_admin());
drop policy if exists "Admins add admins" on public.admin_users;
create policy "Admins add admins" on public.admin_users for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update admins" on public.admin_users;
create policy "Admins update admins" on public.admin_users for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins remove admins" on public.admin_users;
create policy "Admins remove admins" on public.admin_users for delete to authenticated using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.products, public.site_settings, public.hero_slides to anon, authenticated;
grant insert on public.inquiries, public.newsletter_signups, public.event_logs to anon, authenticated;
grant select, insert, update, delete on public.products, public.site_settings, public.hero_slides, public.inquiries, public.newsletter_signups, public.event_logs, public.admin_users to authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN SETUP (run after the schema above)
-- 1. In Supabase Dashboard, open Authentication > Users and create your user.
-- 2. Copy that user's UUID and email.
-- 3. In SQL Editor, run the statement below with your real values:
--
-- insert into public.admin_users (user_id, email, is_active)
-- values ('YOUR-AUTH-USER-UUID'::uuid, 'you@example.com', true)
-- on conflict (user_id) do update set email = excluded.email, is_active = true;
--
-- The first admin must be inserted in SQL Editor because RLS correctly prevents
-- a non-admin browser session from granting itself admin access.

-- ===========================================================================
-- SECURE CHECKOUT + QIKINK FULFILMENT MIGRATION
-- This section is also idempotent and can be run together with the full file.

alter table public.products add column if not exists qikink_sku text default '';
alter table public.products add column if not exists qikink_product_id text default '';
alter table public.products add column if not exists qikink_variant_id text default '';
alter table public.products add column if not exists print_type text default 'DTF';
alter table public.products add column if not exists print_area_front text default '';
alter table public.products add column if not exists print_area_back text default '';
alter table public.products add column if not exists front_design_url text default '';
alter table public.products add column if not exists back_design_url text default '';
alter table public.products add column if not exists base_cost numeric(12,2) not null default 0;
alter table public.products add column if not exists selling_price numeric(12,2);
alter table public.products add column if not exists shipping_charge numeric(12,2) not null default 0;
alter table public.products add column if not exists profit_margin numeric(12,2) not null default 0;

update public.products
set selling_price = coalesce(selling_price, sale_price, price),
    profit_margin = greatest(0, coalesce(selling_price, sale_price, price, 0) - coalesce(base_cost, 0) - coalesce(shipping_charge, 0))
where selling_price is null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  address_line1 text not null,
  address_line2 text default '',
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'IN',
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending_payment',
  payment_provider text not null default 'razorpay',
  payment_status text not null default 'pending',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  amount_paid numeric(12,2) not null default 0,
  qikink_status text not null default 'not_sent',
  qikink_order_id text,
  qikink_attempts integer not null default 0,
  qikink_last_error text,
  qikink_synced_at timestamptz,
  admin_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists address_line1 text;
alter table public.orders add column if not exists address_line2 text default '';
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists state text;
alter table public.orders add column if not exists postal_code text;
alter table public.orders add column if not exists country_code text not null default 'IN';
alter table public.orders add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists shipping_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists total_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists currency text not null default 'INR';
alter table public.orders add column if not exists status text not null default 'pending_payment';
alter table public.orders add column if not exists payment_provider text not null default 'razorpay';
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists razorpay_signature text;
alter table public.orders add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.orders add column if not exists qikink_status text not null default 'not_sent';
alter table public.orders add column if not exists qikink_order_id text;
alter table public.orders add column if not exists qikink_attempts integer not null default 0;
alter table public.orders add column if not exists qikink_last_error text;
alter table public.orders add column if not exists qikink_synced_at timestamptz;
alter table public.orders add column if not exists admin_notes text default '';
alter table public.orders add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();
create unique index if not exists orders_order_number_unique on public.orders (order_number);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_payment_qikink_idx on public.orders (payment_status, qikink_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete restrict,
  product_name text not null,
  sku text default '',
  size text not null,
  colour text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  qikink_sku text default '',
  qikink_product_id text default '',
  qikink_variant_id text default '',
  print_type text default '',
  print_area_front text default '',
  print_area_back text default '',
  front_design_url text default '',
  back_design_url text default '',
  created_at timestamptz not null default now()
);
alter table public.order_items add column if not exists product_id text references public.products(id) on delete restrict;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists sku text default '';
alter table public.order_items add column if not exists size text;
alter table public.order_items add column if not exists colour text;
alter table public.order_items add column if not exists quantity integer;
alter table public.order_items add column if not exists unit_price numeric(12,2);
alter table public.order_items add column if not exists line_total numeric(12,2);
alter table public.order_items add column if not exists qikink_sku text default '';
alter table public.order_items add column if not exists qikink_product_id text default '';
alter table public.order_items add column if not exists qikink_variant_id text default '';
alter table public.order_items add column if not exists print_type text default '';
alter table public.order_items add column if not exists print_area_front text default '';
alter table public.order_items add column if not exists print_area_back text default '';
alter table public.order_items add column if not exists front_design_url text default '';
alter table public.order_items add column if not exists back_design_url text default '';
alter table public.order_items add column if not exists created_at timestamptz not null default now();
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.qikink_order_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  attempt_number integer not null default 1,
  action text not null default 'create_order',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  http_status integer,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists qikink_logs_order_idx on public.qikink_order_logs (order_id, created_at desc);

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_provider text not null default 'razorpay',
  event_type text not null,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  verified boolean not null default false,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);
create unique index if not exists payment_provider_event_unique on public.payment_logs (payment_provider, provider_event_id) where provider_event_id is not null;
create index if not exists payment_logs_order_idx on public.payment_logs (order_id, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.qikink_order_logs enable row level security;
alter table public.payment_logs enable row level security;

drop policy if exists "Public creates pending orders" on public.orders;
create policy "Public creates pending orders" on public.orders for insert to anon, authenticated
with check (payment_status = 'pending' and status = 'pending_payment' and qikink_status = 'not_sent' and amount_paid = 0);
drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders" on public.orders for select to authenticated using (public.is_admin());
drop policy if exists "Admins update non-sync order details" on public.orders;
create policy "Admins update non-sync order details" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public creates order items" on public.order_items;
create policy "Public creates order items" on public.order_items for insert to anon, authenticated with check (quantity between 1 and 10);
drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items" on public.order_items for select to authenticated using (public.is_admin());

drop policy if exists "Admins read Qikink logs" on public.qikink_order_logs;
create policy "Admins read Qikink logs" on public.qikink_order_logs for select to authenticated using (public.is_admin());
drop policy if exists "Admins read payment logs" on public.payment_logs;
create policy "Admins read payment logs" on public.payment_logs for select to authenticated using (public.is_admin());

-- Public checkout uses this function. It validates input and recalculates all
-- prices from published products; browser-submitted prices are ignored.
create or replace function public.create_pending_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment_provider text default 'razorpay'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'VYR-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_unit numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_name text := trim(coalesce(p_customer->>'name', ''));
  v_phone text := regexp_replace(coalesce(p_customer->>'phone', ''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(p_customer->>'email', '')));
  v_address1 text := trim(coalesce(p_customer->>'address_line1', ''));
  v_city text := trim(coalesce(p_customer->>'city', ''));
  v_state text := trim(coalesce(p_customer->>'state', ''));
  v_postal text := regexp_replace(coalesce(p_customer->>'postal_code', ''), '[^0-9]', '', 'g');
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'Order must contain between 1 and 20 items'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Enter a valid customer name'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit Indian mobile number'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  if char_length(v_address1) < 5 or char_length(v_city) < 2 or char_length(v_state) < 2 then raise exception 'Enter a complete delivery address'; end if;
  if v_postal !~ '^[1-9][0-9]{5}$' then raise exception 'Enter a valid Indian pincode'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity < 1 or v_quantity > 10 then raise exception 'Item quantity must be between 1 and 10'; end if;
    select * into v_product from public.products where id = v_item->>'product_id' and is_published = true;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if not (coalesce(v_item->>'size', '') = any(v_product.sizes)) then raise exception 'Invalid size for %', v_product.name; end if;
    if not (coalesce(v_item->>'colour', '') = any(v_product.colours)) then raise exception 'Invalid colour for %', v_product.name; end if;
    v_unit := coalesce(v_product.sale_price, v_product.selling_price, v_product.price, 0);
    if v_unit <= 0 then raise exception 'Invalid selling price for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_unit * v_quantity);
    v_shipping := greatest(v_shipping, coalesce(v_product.shipping_charge, 0));
  end loop;

  insert into public.orders (id, order_number, user_id, customer_name, customer_phone, customer_email, address_line1, address_line2, city, state, postal_code, country_code, subtotal, shipping_amount, total_amount, currency, status, payment_provider, payment_status, amount_paid, qikink_status)
  values (v_order_id, v_order_number, auth.uid(), v_name, v_phone, v_email, v_address1, trim(coalesce(p_customer->>'address_line2', '')), v_city, v_state, v_postal, 'IN', v_subtotal, v_shipping, v_subtotal + v_shipping, 'INR', 'pending_payment', lower(coalesce(nullif(p_payment_provider, ''), 'razorpay')), 'pending', 0, 'not_sent');

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = v_item->>'product_id';
    v_unit := coalesce(v_product.sale_price, v_product.selling_price, v_product.price, 0);
    insert into public.order_items (order_id, product_id, product_name, sku, size, colour, quantity, unit_price, line_total, qikink_sku, qikink_product_id, qikink_variant_id, print_type, print_area_front, print_area_back, front_design_url, back_design_url)
    values (v_order_id, v_product.id, v_product.name, v_product.slug, v_item->>'size', v_item->>'colour', v_quantity, v_unit, v_unit * v_quantity, coalesce(v_product.qikink_sku, ''), coalesce(v_product.qikink_product_id, ''), coalesce(v_product.qikink_variant_id, ''), coalesce(v_product.print_type, ''), coalesce(v_product.print_area_front, ''), coalesce(v_product.print_area_back, ''), coalesce(v_product.front_design_url, ''), coalesce(v_product.back_design_url, ''));
  end loop;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'subtotal', v_subtotal, 'shipping_amount', v_shipping, 'total_amount', v_subtotal + v_shipping, 'currency', 'INR', 'status', 'pending_payment', 'payment_status', 'pending');
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text) from public;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to anon, authenticated;

-- Checkout writes happen through create_pending_order(), not direct table calls.
revoke insert on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items, public.qikink_order_logs, public.payment_logs to authenticated;
revoke update on public.orders from authenticated;
grant update (customer_name, customer_phone, customer_email, address_line1, address_line2, city, state, postal_code, admin_notes, updated_at) on public.orders to authenticated;

comment on column public.orders.payment_status is 'Set to paid only by a verified server-side payment flow; never by the browser.';
comment on column public.orders.qikink_status is 'Updated only by trusted Edge Function/service-role code.';
comment on column public.orders.razorpay_signature is 'Stored only after server-side Razorpay signature verification.';
