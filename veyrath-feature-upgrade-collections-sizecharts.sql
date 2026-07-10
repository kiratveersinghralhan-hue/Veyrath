-- VEYRATH additive feature upgrade: homepage pins, collections and size charts.
-- Safe for the live VEYRATH project: this does NOT delete products, orders or customers.
-- Run this once in Supabase SQL Editor before using the new admin controls.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.products
  add column if not exists is_home_pinned boolean not null default false,
  add column if not exists home_sort_order integer not null default 0;

create table if not exists public.size_charts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  slug text not null unique,
  category text not null default '',
  product_type text not null default '',
  description text not null default '',
  image_url text not null default '',
  image_alt text not null default '',
  facts jsonb not null default '[]'::jsonb,
  fit_notes jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  slug text not null unique,
  drop_label text not null default '',
  subtitle text not null default '',
  description text not null default '',
  cover_image_url text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

drop trigger if exists size_charts_updated on public.size_charts;
create trigger size_charts_updated before update on public.size_charts
for each row execute function public.set_updated_at();

drop trigger if exists collections_updated on public.collections;
create trigger collections_updated before update on public.collections
for each row execute function public.set_updated_at();

alter table public.size_charts enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

drop policy if exists "Public reads published size charts" on public.size_charts;
create policy "Public reads published size charts" on public.size_charts
for select to anon, authenticated
using (is_published or public.is_admin());

drop policy if exists "Admins manage size charts" on public.size_charts;
create policy "Admins manage size charts" on public.size_charts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public reads published collections" on public.collections;
create policy "Public reads published collections" on public.collections
for select to anon, authenticated
using (is_published or public.is_admin());

drop policy if exists "Admins manage collections" on public.collections;
create policy "Admins manage collections" on public.collections
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public reads published collection products" on public.collection_products;
create policy "Public reads published collection products" on public.collection_products
for select to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.collections c
    join public.products p on p.id = product_id
    where c.id = collection_id
      and c.is_published = true
      and p.is_published = true
  )
);

drop policy if exists "Admins manage collection products" on public.collection_products;
create policy "Admins manage collection products" on public.collection_products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace view public.storefront_products
with (security_invoker=true) as
select
  id,
  slug,
  name,
  description,
  category,
  gender,
  price,
  compare_at_price,
  selling_price,
  currency,
  images,
  image_url,
  front_design_url,
  back_design_url,
  sizes,
  colours,
  tags,
  style,
  rating,
  is_published,
  is_featured,
  is_home_pinned,
  home_sort_order,
  sort_order,
  shipping_cost,
  fulfilment_status,
  created_at,
  updated_at
from public.products
where is_published = true;

create or replace view public.admin_products
with (security_invoker=true) as
select p.*
from public.products p
where public.is_admin();

grant select on public.storefront_products to anon, authenticated;
grant select on public.admin_products to authenticated;
grant select on public.size_charts, public.collections, public.collection_products to anon, authenticated;
grant insert, update, delete on public.size_charts, public.collections, public.collection_products to authenticated;
grant all on public.size_charts, public.collections, public.collection_products to service_role;

grant select(
  id, slug, name, description, category, gender, price, compare_at_price,
  selling_price, currency, images, image_url, front_design_url, back_design_url,
  sizes, colours, tags, style, rating, is_published, is_featured,
  is_home_pinned, home_sort_order, sort_order, shipping_cost,
  fulfilment_status, created_at, updated_at
) on public.products to anon, authenticated;

grant update(is_home_pinned, home_sort_order) on public.products to authenticated;

create index if not exists products_home_pinned_idx
  on public.products(is_home_pinned, home_sort_order desc, sort_order desc)
  where is_published = true;

create index if not exists size_charts_public_idx
  on public.size_charts(is_published, sort_order);

create index if not exists collections_public_idx
  on public.collections(is_published, sort_order);

create index if not exists collection_products_product_idx
  on public.collection_products(product_id, sort_order);

commit;

select
  'VEYRATH feature upgrade installed without deleting product data.' as status,
  (select count(*) from public.products) as existing_products_kept,
  (select count(*) from public.collections) as collections,
  (select count(*) from public.size_charts) as size_charts;
