-- VEYRATH non-destructive multi-image gallery migration
-- Run once in the VEYRATH Supabase SQL Editor. Existing products and orders remain intact.

begin;

alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public reads VEYRATH product images" on storage.objects;
drop policy if exists "Admins upload VEYRATH product images" on storage.objects;
drop policy if exists "Admins update VEYRATH product images" on storage.objects;
drop policy if exists "Admins delete VEYRATH product images" on storage.objects;

create policy "Public reads VEYRATH product images"
on storage.objects for select to anon,authenticated
using(bucket_id='product-images');

create policy "Admins upload VEYRATH product images"
on storage.objects for insert to authenticated
with check(bucket_id='product-images' and public.is_admin());

create policy "Admins update VEYRATH product images"
on storage.objects for update to authenticated
using(bucket_id='product-images' and public.is_admin())
with check(bucket_id='product-images' and public.is_admin());

create policy "Admins delete VEYRATH product images"
on storage.objects for delete to authenticated
using(bucket_id='product-images' and public.is_admin());

commit;
