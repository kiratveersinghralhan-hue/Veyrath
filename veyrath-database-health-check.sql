-- VEYRATH DATABASE HEALTH CHECK
-- Safe and non-destructive: this script creates only a temporary report table.
-- Run in the VEYRATH Supabase project SQL Editor (project ref: cefxwkvefadptyzeayfx).
-- Review every FAIL and WARN row. MANUAL rows cannot be verified from PostgreSQL.

create temporary table if not exists veyrath_audit_report (
  severity integer not null,
  status text not null,
  area text not null,
  check_name text not null,
  details text not null,
  fix_hint text not null default ''
) on commit preserve rows;

truncate table veyrath_audit_report;

-- Required tables.
with expected(name) as (values
  ('admin_users'), ('products'), ('customers'), ('orders'), ('order_items'),
  ('payment_logs'), ('printrove_order_logs'), ('site_settings'), ('hero_slides'),
  ('inquiries'), ('newsletter_signups'), ('event_logs')
)
insert into veyrath_audit_report
select case when c.oid is null then 1 else 3 end,
       case when c.oid is null then 'FAIL' else 'PASS' end,
       'Database objects', 'Table public.' || e.name,
       case when c.oid is null then 'Required table is missing.' else 'Required table exists.' end,
       case when c.oid is null then 'Restore this table from the current supabase-schema.sql.' else '' end
from expected e
left join pg_class c on c.oid = to_regclass('public.' || e.name) and c.relkind in ('r','p');

-- Required views.
with expected(name) as (values ('storefront_products'), ('admin_products'))
insert into veyrath_audit_report
select case when c.oid is null then 1 else 3 end,
       case when c.oid is null then 'FAIL' else 'PASS' end,
       'Database objects', 'View public.' || e.name,
       case when c.oid is null then 'Required view is missing.' else 'Required view exists.' end,
       case when c.oid is null then 'Recreate the view from the current supabase-schema.sql.' else '' end
from expected e
left join pg_class c on c.oid = to_regclass('public.' || e.name) and c.relkind = 'v';

-- Public storefront view must use caller permissions. Admin view hardening is reported as a warning.
with expected(name, missing_severity) as (values ('storefront_products', 1), ('admin_products', 2))
insert into veyrath_audit_report
select case when c.oid is null or not coalesce(c.reloptions @> array['security_invoker=true'], false) then e.missing_severity else 3 end,
       case when c.oid is null or not coalesce(c.reloptions @> array['security_invoker=true'], false)
            then case when e.missing_severity = 1 then 'FAIL' else 'WARN' end else 'PASS' end,
       'Security', 'Security-invoker view public.' || e.name,
       case when c.oid is null then 'View is missing.'
            when coalesce(c.reloptions @> array['security_invoker=true'], false) then 'security_invoker=true.'
            else 'View does not declare security_invoker=true.' end,
       case when c.oid is null or not coalesce(c.reloptions @> array['security_invoker=true'], false)
            then 'Recreate this view with (security_invoker=true).' else '' end
from expected e
left join pg_class c on c.oid = to_regclass('public.' || e.name) and c.relkind = 'v';

-- Critical columns and PostgreSQL types.
with expected(table_name, column_name, udt_name) as (values
  ('admin_users','user_id','uuid'), ('admin_users','email','text'), ('admin_users','is_active','bool'),
  ('products','id','uuid'), ('products','slug','text'), ('products','price','numeric'),
  ('products','selling_price','numeric'), ('products','images','jsonb'), ('products','image_url','text'),
  ('products','sizes','_text'), ('products','colours','_text'), ('products','is_published','bool'),
  ('products','printrove_sku','text'), ('products','printrove_product_id','text'),
  ('products','printrove_variant_id','text'), ('products','printrove_variant_map','jsonb'),
  ('products','front_design_url','text'), ('products','back_design_url','text'),
  ('products','base_cost','numeric'), ('products','shipping_cost','numeric'),
  ('orders','id','uuid'), ('orders','order_number','text'), ('orders','total_amount','numeric'),
  ('orders','amount_paid','numeric'), ('orders','payment_provider','text'), ('orders','payment_status','text'),
  ('orders','order_status','text'), ('orders','fulfilment_status','text'),
  ('orders','razorpay_order_id','text'), ('orders','razorpay_payment_id','text'),
  ('orders','razorpay_signature','text'), ('orders','printrove_order_id','text'),
  ('orders','printrove_status','text'), ('orders','courier_name','text'),
  ('orders','tracking_number','text'), ('orders','tracking_url','text'),
  ('orders','payment_fee','numeric'), ('orders','payment_tax','numeric'),
  ('orders','estimated_settlement_amount','numeric'),
  ('order_items','order_id','uuid'), ('order_items','product_id','uuid'),
  ('order_items','size','text'), ('order_items','colour','text'), ('order_items','quantity','int4'),
  ('order_items','unit_price','numeric'), ('order_items','printrove_variant_id','text'),
  ('payment_logs','raw_payload','jsonb'), ('printrove_order_logs','response_payload','jsonb')
)
insert into veyrath_audit_report
select case when c.column_name is null or c.udt_name <> e.udt_name then 1 else 3 end,
       case when c.column_name is null or c.udt_name <> e.udt_name then 'FAIL' else 'PASS' end,
       'Columns', e.table_name || '.' || e.column_name,
       case when c.column_name is null then 'Column is missing.'
            when c.udt_name <> e.udt_name then 'Wrong type: ' || c.udt_name || '; expected ' || e.udt_name || '.'
            else 'Column exists with type ' || e.udt_name || '.' end,
       case when c.column_name is null or c.udt_name <> e.udt_name
            then 'Apply the matching column definition from supabase-schema.sql.' else '' end
from expected e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name;

-- RLS must be enabled on every public data table.
with expected(name) as (values
  ('admin_users'), ('products'), ('customers'), ('orders'), ('order_items'),
  ('payment_logs'), ('printrove_order_logs'), ('site_settings'), ('hero_slides'),
  ('inquiries'), ('newsletter_signups'), ('event_logs')
)
insert into veyrath_audit_report
select case when c.oid is null or not c.relrowsecurity then 1 else 3 end,
       case when c.oid is null or not c.relrowsecurity then 'FAIL' else 'PASS' end,
       'Security', 'RLS public.' || e.name,
       case when c.oid is null then 'Table is missing.'
            when c.relrowsecurity then 'Row Level Security is enabled.'
            else 'Row Level Security is disabled.' end,
       case when c.oid is null or not c.relrowsecurity then 'Enable RLS before accepting live traffic.' else '' end
from expected e
left join pg_class c on c.oid = to_regclass('public.' || e.name) and c.relkind in ('r','p');

-- Required public/admin policies.
with expected(table_name, policy_name) as (values
  ('products','Published product rows are visible'),
  ('products','Admins create products'), ('products','Admins update products'), ('products','Admins delete products'),
  ('orders','Public creates pending orders'), ('orders','Admins read orders'),
  ('order_items','Public creates pending order items'), ('order_items','Admins read order items'),
  ('payment_logs','Admins read payment logs'), ('printrove_order_logs','Admins read Printrove logs'),
  ('site_settings','Public reads public settings'), ('site_settings','Admins manage settings'),
  ('hero_slides','Public reads published slides'), ('hero_slides','Admins manage slides'),
  ('inquiries','Public creates inquiries'), ('newsletter_signups','Public joins newsletter'),
  ('admin_users','Admin reads own access'), ('admin_users','Admins manage access')
)
insert into veyrath_audit_report
select case when p.policyname is null then 1 else 3 end,
       case when p.policyname is null then 'FAIL' else 'PASS' end,
       'RLS policies', e.table_name || ' / ' || e.policy_name,
       case when p.policyname is null then 'Required policy is missing.' else 'Policy exists.' end,
       case when p.policyname is null then 'Recreate this policy from supabase-schema.sql.' else '' end
from expected e
left join pg_policies p on p.schemaname = 'public' and p.tablename = e.table_name and p.policyname = e.policy_name;

-- Checkout function signatures: exactly one two-argument version must remain.
with functions as (
  select count(*) as overload_count,
         coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), 'none') as signatures
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_pending_order'
)
insert into veyrath_audit_report
select case when overload_count = 1 and to_regprocedure('public.create_pending_order(jsonb,jsonb)') is not null then 3 else 1 end,
       case when overload_count = 1 and to_regprocedure('public.create_pending_order(jsonb,jsonb)') is not null then 'PASS' else 'FAIL' end,
       'Checkout RPC', 'Unique create_pending_order signature',
       'Found: ' || signatures || '.',
       case when overload_count = 1 and to_regprocedure('public.create_pending_order(jsonb,jsonb)') is not null
            then '' else 'Run checkout-rpc-overload-fix.sql, then rerun this audit.' end
from functions;

insert into veyrath_audit_report
select case when p.oid is not null and p.prosecdef then 3 else 1 end,
       case when p.oid is not null and p.prosecdef then 'PASS' else 'FAIL' end,
       'Checkout RPC', 'Server-authoritative checkout function',
       case when p.oid is null then 'Two-argument function is missing.'
            when p.prosecdef then 'Function is SECURITY DEFINER.'
            else 'Function is not SECURITY DEFINER.' end,
       case when p.oid is null or not p.prosecdef then 'Restore the current function from supabase-schema.sql.' else '' end
from (select to_regprocedure('public.create_pending_order(jsonb,jsonb)')::oid as oid) x
left join pg_proc p on p.oid = x.oid;

do $$
declare
  fn oid := to_regprocedure('public.create_pending_order(jsonb,jsonb)')::oid;
  anon_ok boolean := false;
  auth_ok boolean := false;
begin
  if fn is not null then
    anon_ok := has_function_privilege('anon', fn, 'EXECUTE');
    auth_ok := has_function_privilege('authenticated', fn, 'EXECUTE');
  end if;
  insert into veyrath_audit_report values
    (case when anon_ok and auth_ok then 3 else 1 end,
     case when anon_ok and auth_ok then 'PASS' else 'FAIL' end,
     'Checkout RPC', 'Checkout execute grants',
     'anon=' || anon_ok::text || ', authenticated=' || auth_ok::text || '.',
     case when anon_ok and auth_ok then '' else 'Grant EXECUTE on public.create_pending_order(jsonb,jsonb) to anon and authenticated.' end);
end
$$;

-- Admin helper and timestamp/order-number functions.
with expected(signature) as (values
  ('public.is_admin()'), ('public.set_updated_at()'), ('public.make_order_number()'),
  ('public.track_order(text,text)')
)
insert into veyrath_audit_report
select case when to_regprocedure(e.signature) is null then 1 else 3 end,
       case when to_regprocedure(e.signature) is null then 'FAIL' else 'PASS' end,
       'Functions', e.signature,
       case when to_regprocedure(e.signature) is null then 'Function is missing.' else 'Function exists.' end,
       case when to_regprocedure(e.signature) is null then 'Restore it from supabase-schema.sql.' else '' end
from expected e;

-- Expected maintenance triggers.
with expected(table_name, trigger_name) as (values
  ('admin_users','admin_users_updated'), ('products','products_updated'),
  ('customers','customers_updated'), ('orders','orders_updated'),
  ('site_settings','site_settings_updated'), ('hero_slides','hero_slides_updated'),
  ('inquiries','inquiries_updated'), ('newsletter_signups','newsletter_updated')
)
insert into veyrath_audit_report
select case when t.oid is null or t.tgenabled = 'D' then 2 else 3 end,
       case when t.oid is null or t.tgenabled = 'D' then 'WARN' else 'PASS' end,
       'Triggers', e.table_name || ' / ' || e.trigger_name,
       case when t.oid is null then 'Trigger is missing.' when t.tgenabled = 'D' then 'Trigger is disabled.' else 'Trigger is enabled.' end,
       case when t.oid is null or t.tgenabled = 'D' then 'Restore/enable this updated_at trigger from supabase-schema.sql.' else '' end
from expected e
left join pg_trigger t on t.tgrelid = to_regclass('public.' || e.table_name) and t.tgname = e.trigger_name and not t.tgisinternal;

-- Storage policies can be checked from the catalog even if the storage table is unavailable.
with expected(policy_name) as (values
  ('Public reads VEYRATH product images'), ('Admins upload VEYRATH product images'),
  ('Admins update VEYRATH product images'), ('Admins delete VEYRATH product images')
)
insert into veyrath_audit_report
select case when p.policyname is null then 1 else 3 end,
       case when p.policyname is null then 'FAIL' else 'PASS' end,
       'Storage', e.policy_name,
       case when p.policyname is null then 'Storage policy is missing.' else 'Storage policy exists.' end,
       case when p.policyname is null then 'Recreate the product-images storage policies from supabase-schema.sql.' else '' end
from expected e
left join pg_policies p on p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname = e.policy_name;

-- Data-level health checks use guarded dynamic SQL so missing tables are reported above instead of crashing this audit.
do $$
declare
  n bigint;
  bad bigint;
begin
  if to_regclass('auth.users') is not null and to_regclass('public.admin_users') is not null then
    execute $q$select count(*) from auth.users u join public.admin_users a on a.user_id=u.id
               where lower(u.email)=lower('kiratveersinghralhan@gmail.com') and a.is_active$q$ into n;
    insert into veyrath_audit_report values
      (case when n = 1 then 3 else 1 end, case when n = 1 then 'PASS' else 'FAIL' end,
       'Admin', 'Active VEYRATH admin user', n || ' active matching admin account(s).',
       case when n = 1 then '' else 'Create/confirm the Auth user, then run admin-access.sql in this VEYRATH project.' end);
  end if;

  if to_regclass('public.products') is not null then
    execute 'select count(*) from public.products where is_published' into n;
    insert into veyrath_audit_report values
      (case when n > 0 then 3 else 2 end, case when n > 0 then 'PASS' else 'WARN' end,
       'Catalogue', 'Published products', n || ' published product(s).',
       case when n > 0 then '' else 'Publish at least one correctly configured product in Admin.' end);

    execute $q$select count(*) from public.products where is_published
               and coalesce(nullif(selling_price,0),price) <= 0$q$ into bad;
    insert into veyrath_audit_report values
      (case when bad = 0 then 3 else 1 end, case when bad = 0 then 'PASS' else 'FAIL' end,
       'Catalogue', 'Published product prices', bad || ' published product(s) have no payable price.',
       case when bad = 0 then '' else 'Set a positive selling price or store price for every published product.' end);

    execute $q$select count(*) from public.products where is_published
               and coalesce(image_url,'')=''
               and case when jsonb_typeof(images)='array' then jsonb_array_length(images) else 0 end = 0$q$ into bad;
    insert into veyrath_audit_report values
      (case when bad = 0 then 3 else 2 end, case when bad = 0 then 'PASS' else 'WARN' end,
       'Catalogue', 'Published product images', bad || ' published product(s) have no image.',
       case when bad = 0 then '' else 'Upload at least one product image for each published product.' end);

    execute $q$select count(*) from public.products where is_published and fulfilment_status in ('mapped','ready')
               and coalesce(printrove_variant_id,'')='' and coalesce(printrove_variant_map,'{}'::jsonb)='{}'::jsonb$q$ into bad;
    insert into veyrath_audit_report values
      (case when bad = 0 then 3 else 1 end, case when bad = 0 then 'PASS' else 'FAIL' end,
       'Printrove', 'Published fulfilment variant mapping', bad || ' mapped/ready product(s) have no Printrove variant mapping.',
       case when bad = 0 then '' else 'Add a default Printrove Variant ID or complete Colour|Size variant map.' end);
  end if;

  if to_regclass('public.site_settings') is not null then
    execute $q$select count(*) from public.site_settings where key in ('commerce','site_data')$q$ into n;
    insert into veyrath_audit_report values
      (case when n = 2 then 3 else 1 end, case when n = 2 then 'PASS' else 'FAIL' end,
       'Settings', 'Commerce and site settings', n || ' of 2 required setting rows exist.',
       case when n = 2 then '' else 'Restore commerce and site_data rows from supabase-schema.sql.' end);
  end if;

  if to_regclass('public.hero_slides') is not null then
    execute 'select count(*) from public.hero_slides where is_published' into n;
    insert into veyrath_audit_report values
      (case when n > 0 then 3 else 2 end, case when n > 0 then 'PASS' else 'WARN' end,
       'Homepage', 'Published hero slides', n || ' published slide(s).',
       case when n > 0 then '' else 'Publish at least one hero slide or use the static fallback.' end);
  end if;

  if to_regclass('storage.buckets') is not null then
    execute $q$select count(*) from storage.buckets where id='product-images' and public=true$q$ into n;
    insert into veyrath_audit_report values
      (case when n = 1 then 3 else 1 end, case when n = 1 then 'PASS' else 'FAIL' end,
       'Storage', 'Public product-images bucket', n || ' matching public bucket(s).',
       case when n = 1 then '' else 'Create/update the product-images bucket using supabase-schema.sql.' end);
  else
    insert into veyrath_audit_report values
      (1, 'FAIL', 'Storage', 'Supabase Storage schema', 'storage.buckets is unavailable.', 'Enable Supabase Storage for this project.');
  end if;

  if to_regclass('public.orders') is not null then
    execute 'select count(*) from public.orders' into n;
    insert into veyrath_audit_report values
      (4, 'INFO', 'Orders', 'Order count', n || ' total order record(s).', '');
  end if;
end
$$;

-- These deployment/runtime items are intentionally manual: PostgreSQL cannot see Edge Function deployments or secrets.
insert into veyrath_audit_report values
  (5, 'MANUAL', 'Edge Functions', 'Required deployments',
    'Check create-razorpay-order, verify-razorpay-payment, razorpay-webhook, send-to-printrove, sync-printrove-status and track-order in Supabase > Edge Functions.',
   'Deploy missing functions using the commands in README.txt.'),
  (5, 'MANUAL', 'Secrets', 'Razorpay secrets',
   'Check RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in Supabase > Edge Functions > Secrets.',
   'Use Razorpay TEST credentials until the complete payment flow is verified.'),
  (5, 'MANUAL', 'Secrets', 'Printrove secrets',
   'Check PRINTROVE_EMAIL and PRINTROVE_PASSWORD, or PRINTROVE_API_TOKEN/PRINTROVE_API_KEY.',
   'Never put these secrets in frontend or GitHub files.'),
  (5, 'MANUAL', 'Secrets', 'Supabase and site secrets',
   'Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SITE_URL. SITE_URL should be https://kiratveersinghralhan-hue.github.io.',
   'Keep the service-role key only in Supabase secrets.'),
  (5, 'MANUAL', 'Razorpay', 'Webhook dashboard configuration',
   'Confirm the webhook URL ends with /functions/v1/razorpay-webhook and events payment.captured, order.paid and payment.failed are enabled.',
   'The Razorpay webhook secret must exactly match RAZORPAY_WEBHOOK_SECRET.');

-- Final report. A healthy database has total_fail = 0. WARN rows should be reviewed before launch.
select status,
       area,
       check_name,
       details,
       fix_hint,
       count(*) filter (where status = 'FAIL') over () as total_fail,
       count(*) filter (where status = 'WARN') over () as total_warn,
       count(*) filter (where status = 'PASS') over () as total_pass
from veyrath_audit_report
order by severity, area, check_name;
