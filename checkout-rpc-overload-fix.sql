-- VEYRATH one-time checkout RPC overload cleanup
-- Safe for existing products, customers, orders and payments.
-- Run this in the VEYRATH Supabase project SQL Editor.

begin;

do $$
begin
  if to_regprocedure('public.create_pending_order(jsonb,jsonb)') is null then
    raise exception 'The required two-argument create_pending_order function is missing. Run the current supabase-schema.sql first.';
  end if;
end
$$;

-- A legacy three-argument overload with a default payment provider makes
-- PostgREST unable to choose between it and the current two-argument RPC.
drop function if exists public.create_pending_order(jsonb,jsonb,text);

revoke all on function public.create_pending_order(jsonb,jsonb) from public;
grant execute on function public.create_pending_order(jsonb,jsonb) to anon, authenticated;

commit;

-- Ask Supabase/PostgREST to refresh its cached RPC signatures immediately.
notify pgrst, 'reload schema';

-- Expected result: exactly one row ending in (jsonb,jsonb).
select p.oid::regprocedure as active_checkout_rpc
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_pending_order'
order by 1;
