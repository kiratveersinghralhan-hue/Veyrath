-- VEYRATH SUPABASE SCHEMA
-- Run this in Supabase SQL Editor.
-- After creating your admin auth user, add its auth.users.id to public.admin_users.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  category text default 'tshirts',
  gender text default 'unisex',
  style text default 'premium',
  budget text default 'mid',
  price numeric default 0,
  mrp numeric default 0,
  rating numeric default 0,
  reviews_count integer default 0,
  description text default '',
  image_url text default '',
  gallery text[] default '{}',
  blink_url text default '',
  is_featured boolean default false,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.newsletter (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text default '',
  source text default 'newsletter',
  consent boolean default true,
  note text default '',
  created_at timestamptz default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text default '',
  email text default '',
  phone text default '',
  subject text default '',
  message text default '',
  source text default 'inquiry',
  created_at timestamptz default now()
);

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  page_path text default '',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.newsletter enable row level security;
alter table public.inquiries enable row level security;
alter table public.event_logs enable row level security;

-- Admin user table: only admins can read admin list.
drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users" on public.admin_users
for select using (public.is_admin());

-- Products: public can read published products. Admin can manage all products.
drop policy if exists "Public can read published products" on public.products;
create policy "Public can read published products" on public.products
for select using (is_published = true or public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products
for insert with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products
for delete using (public.is_admin());

-- Newsletter/inquiries: public can insert; admins can read.
drop policy if exists "Anyone can join newsletter" on public.newsletter;
create policy "Anyone can join newsletter" on public.newsletter
for insert with check (true);

drop policy if exists "Admins can read newsletter" on public.newsletter;
create policy "Admins can read newsletter" on public.newsletter
for select using (public.is_admin());

drop policy if exists "Anyone can submit inquiry" on public.inquiries;
create policy "Anyone can submit inquiry" on public.inquiries
for insert with check (true);

drop policy if exists "Admins can read inquiries" on public.inquiries;
create policy "Admins can read inquiries" on public.inquiries
for select using (public.is_admin());

-- Analytics: public can insert events; admins can read.
drop policy if exists "Anyone can insert event logs" on public.event_logs;
create policy "Anyone can insert event logs" on public.event_logs
for insert with check (true);

drop policy if exists "Admins can read event logs" on public.event_logs;
create policy "Admins can read event logs" on public.event_logs
for select using (public.is_admin());

-- STEP AFTER CREATING ADMIN USER IN SUPABASE AUTH:
-- Replace the UUID and email below, then run it separately.
-- insert into public.admin_users (user_id, email) values ('YOUR_AUTH_USER_UUID', 'your-email@example.com');
