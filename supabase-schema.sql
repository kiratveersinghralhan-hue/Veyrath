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
