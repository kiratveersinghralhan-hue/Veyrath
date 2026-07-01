-- VEYRATH COMPLETE DATABASE RESET — 2026-07-01
-- WARNING: Running this file permanently deletes the listed VEYRATH tables and their data.
-- It intentionally does NOT delete Supabase Authentication users.
-- Before running: create the admin in Authentication > Users using
-- kiratveersinghralhan@gmail.com and the private password chosen by the owner.

begin;
create extension if not exists pgcrypto;

drop table if exists public.qikink_order_logs cascade;
drop table if exists public.payment_logs cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.coupons cascade;
drop table if exists public.event_logs cascade;
drop table if exists public.newsletter_signups cascade;
drop table if exists public.inquiries cascade;
drop table if exists public.hero_slides cascade;
drop table if exists public.site_settings cascade;
drop table if exists public.products cascade;
drop table if exists public.admin_users cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  compare_at_price numeric(12,2) not null default 0 check (compare_at_price >= 0),
  category text not null default 'T-Shirts',
  gender text not null default 'Unisex',
  sizes text[] not null default '{}',
  colours text[] not null default '{}',
  tags text[] not null default '{}',
  style text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  image_url text not null default '',
  front_design_url text not null default '',
  back_design_url text not null default '',
  printrove_sku text not null default '',
  printrove_product_id text not null default '',
  printrove_variant_id text not null default '',
  fulfilment_status text not null default 'planned' check (fulfilment_status in ('planned','mapped','ready','paused')),
  external_url text not null default '',
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  eyebrow text not null default '',
  heading text not null,
  body text not null default '',
  image_url text not null,
  align text not null default 'left' check (align in ('left','right','center')),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  subject text not null default 'Product enquiry',
  product text not null default '',
  message text not null,
  status text not null default 'new' check (status in ('new','open','resolved','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'website',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  page_path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
create trigger site_settings_updated before update on public.site_settings for each row execute function public.set_updated_at();
create trigger hero_slides_updated before update on public.hero_slides for each row execute function public.set_updated_at();
create trigger inquiries_updated before update on public.inquiries for each row execute function public.set_updated_at();
create trigger newsletter_updated before update on public.newsletter_signups for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.hero_slides enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_signups enable row level security;
alter table public.event_logs enable row level security;

create policy "Public reads published products" on public.products for select to anon, authenticated using (is_published or public.is_admin());
create policy "Admins insert products" on public.products for insert to authenticated with check (public.is_admin());
create policy "Admins update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete products" on public.products for delete to authenticated using (public.is_admin());

create policy "Public reads public settings" on public.site_settings for select to anon, authenticated using (is_public or public.is_admin());
create policy "Admins insert settings" on public.site_settings for insert to authenticated with check (public.is_admin());
create policy "Admins update settings" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete settings" on public.site_settings for delete to authenticated using (public.is_admin());

create policy "Public reads published slides" on public.hero_slides for select to anon, authenticated using (is_published or public.is_admin());
create policy "Admins insert slides" on public.hero_slides for insert to authenticated with check (public.is_admin());
create policy "Admins update slides" on public.hero_slides for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete slides" on public.hero_slides for delete to authenticated using (public.is_admin());

create policy "Public creates inquiries" on public.inquiries for insert to anon, authenticated with check (char_length(name) between 2 and 120 and char_length(email) between 3 and 320 and char_length(message) between 1 and 5000);
create policy "Admins read inquiries" on public.inquiries for select to authenticated using (public.is_admin());
create policy "Admins update inquiries" on public.inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete inquiries" on public.inquiries for delete to authenticated using (public.is_admin());

create policy "Public joins newsletter" on public.newsletter_signups for insert to anon, authenticated with check (char_length(email) between 3 and 320);
create policy "Admins read newsletter" on public.newsletter_signups for select to authenticated using (public.is_admin());
create policy "Admins update newsletter" on public.newsletter_signups for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete newsletter" on public.newsletter_signups for delete to authenticated using (public.is_admin());

create policy "Public creates events" on public.event_logs for insert to anon, authenticated with check (char_length(event_name) between 1 and 100);
create policy "Admins read events" on public.event_logs for select to authenticated using (public.is_admin());
create policy "Admins delete events" on public.event_logs for delete to authenticated using (public.is_admin());

create policy "Admin reads own access row" on public.admin_users for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.products, public.site_settings, public.hero_slides to anon, authenticated;
grant insert on public.inquiries, public.newsletter_signups, public.event_logs to anon, authenticated;
grant select, insert, update, delete on public.products, public.site_settings, public.hero_slides, public.inquiries, public.newsletter_signups, public.event_logs, public.admin_users to authenticated;

insert into public.site_settings (key, value, is_public) values ('site_data', $json$
{
  "hero": {"eyebrow":"VEYRATH / BORN AFTER DARK","heading":"Own every. silent. move.","subheading":"Oversized streetwear for the ones who never need to announce themselves.","primary_label":"Shop collection","primary_link":"shop.html","secondary_label":"Join inner circle","secondary_link":"#inner-circle","image_url":"veyrath-hero.jpg"},
  "about_text":"VEYRATH is made for the ones who move in silence. Every piece blends oversized streetwear, subtle astrology details, and dark luxury energy — designed to feel powerful without being loud.",
  "marquee_text":"BORN AFTER DARK • OVERSIZED FIRST • BUILT IN INDIA • MADE AFTER ORDER • SILENT AMBITION •",
  "offers":[{"kicker":"FIRST SIGNAL","text":"10% OFF WITH CODE AFTERDARK10"},{"kicker":"FREE SHIPPING","text":"ON ORDERS ABOVE ₹1,999"},{"kicker":"INNER CIRCLE","text":"EARLY ACCESS TO EVERY DROP"},{"kicker":"MADE AFTER ORDER","text":"LESS EXCESS. MORE INTENTION."}],
  "category_intro":"Essential forms, cut with intention. Start with oversized tees and move deeper after dark.",
  "categories":[{"name":"Oversized T-Shirts","image":"veyrath-tee.jpg","query":"T-Shirts","note":"Heavyweight. Relaxed. Unapologetic."},{"name":"Hoodies","image":"veyrath-hoodies.jpg","query":"Hoodies","note":"Built for the hours after midnight."},{"name":"Lowers","image":"veyrath-hoodies.jpg","query":"Lowers","note":"Quiet comfort with deliberate volume."},{"name":"Accessories","image":"veyrath-accessories.jpg","query":"Accessories","note":"Small signals. Lasting orbit."}]
}
$json$::jsonb, true);

insert into public.hero_slides (eyebrow, heading, body, image_url, align, sort_order) values
('Campaign 001','Silence has a silhouette.','Heavyweight black. Deliberate volume. A signal without noise.','veyrath-carousel-01.jpg','right',1),
('Campaign 002','Enter the orbit.','An original celestial system, drawn for the hours after dark.','veyrath-carousel-02.jpg','left',2),
('Campaign 003','Two forms. One frequency.','The VEYRATH uniform moves differently on everyone.','veyrath-carousel-03.jpg','center',3),
('Born After Dark','Own every silent move.','The first chapter is written in black.','veyrath-hero.jpg','left',4);

-- Adds the owner only when the Auth user already exists. No password is stored in SQL.
insert into public.admin_users (user_id, email, is_active)
select id, email, true from auth.users where lower(email) = 'kiratveersinghralhan@gmail.com'
on conflict (user_id) do update set email = excluded.email, is_active = true;

create index products_public_order_idx on public.products (is_published, sort_order desc);
create index hero_slides_public_order_idx on public.hero_slides (is_published, sort_order);
create index inquiries_created_idx on public.inquiries (created_at desc);
create index newsletter_created_idx on public.newsletter_signups (created_at desc);

commit;

-- If the admin Auth user was created after this reset, run only this statement:
-- insert into public.admin_users (user_id, email, is_active)
-- select id, email, true from auth.users where lower(email) = 'kiratveersinghralhan@gmail.com'
-- on conflict (user_id) do update set email = excluded.email, is_active = true;
