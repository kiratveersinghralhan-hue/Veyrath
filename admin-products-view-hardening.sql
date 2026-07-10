-- VEYRATH optional admin view hardening
-- Safe and non-destructive. Run once in the VEYRATH Supabase SQL Editor.

begin;

alter view public.admin_products set (security_invoker = true);
grant select on public.admin_products to authenticated;

commit;

notify pgrst, 'reload schema';

select
  c.relname as view_name,
  c.reloptions,
  case when c.reloptions @> array['security_invoker=true'] then 'PASS' else 'WARN' end as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'admin_products'
  and c.relkind = 'v';
