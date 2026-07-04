-- VEYRATH LIVE AUTOMATION UPGRADE
-- Run once in the VEYRATH Supabase SQL Editor.
-- This preserves existing data. It does NOT reset or delete tables.
-- It links the one order already created manually in Printrove before enabling
-- automatic placement for future paid orders.

begin;

alter table public.orders add column if not exists courier_name text not null default '';
alter table public.orders add column if not exists tracking_number text not null default '';
alter table public.orders add column if not exists tracking_url text not null default '';
alter table public.orders add column if not exists payment_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists payment_tax numeric(12,2) not null default 0;
alter table public.orders add column if not exists estimated_settlement_amount numeric(12,2) not null default 0;

-- Backfill fee visibility for already-verified payments from the private Razorpay
-- response already stored in payment_logs. Razorpay's fee field includes tax.
with latest_payment as (
  select distinct on (pl.order_id) pl.order_id,pl.raw_payload
  from public.payment_logs pl
  where pl.event_type = 'payment_verified'
  order by pl.order_id,pl.created_at desc
)
update public.orders o
set payment_fee = round(coalesce(nullif(p.raw_payload->>'fee','')::numeric,0) / 100, 2),
    payment_tax = round(coalesce(nullif(p.raw_payload->>'tax','')::numeric,0) / 100, 2),
    estimated_settlement_amount = greatest(0, o.amount_paid - round(coalesce(nullif(p.raw_payload->>'fee','')::numeric,0) / 100, 2))
from latest_payment p
where p.order_id = o.id and o.payment_status = 'paid';

do $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where order_number = 'VYR-260704-36B919B4'
  for update;

  if not found then
    raise exception 'Could not find paid VEYRATH order VYR-260704-36B919B4. Automation was not enabled.';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Order VYR-260704-36B919B4 is not marked paid. Automation was not enabled.';
  end if;

  if v_order.printrove_order_id is not null and v_order.printrove_order_id <> '711902' then
    raise exception 'This VEYRATH order is already linked to a different Printrove order: %', v_order.printrove_order_id;
  end if;

  update public.orders
  set printrove_order_id = '711902',
      printrove_status = case when coalesce(printrove_status,'') = '' then 'received' else printrove_status end,
      fulfilment_status = 'printrove_created',
      order_status = 'processing',
      notes = trim(concat_ws(E'\n', nullif(notes,''), 'Manual Printrove order 711902 reconciled before automation.')),
      updated_at = now()
  where id = v_order.id;

  if not exists (
    select 1 from public.printrove_order_logs
    where order_id = v_order.id and action = 'manual_reconciliation' and status = 'success'
  ) then
    insert into public.printrove_order_logs(order_id,action,status,response_payload)
    values(v_order.id,'manual_reconciliation','success','{"printrove_order_id":"711902","source":"merchant_panel"}'::jsonb);
  end if;
end
$$;

create or replace function public.track_order(p_order_number text, p_contact text)
returns table (
  order_number text,
  payment_status text,
  order_status text,
  fulfilment_status text,
  printrove_status text,
  courier_name text,
  tracking_number text,
  tracking_url text,
  created_at timestamptz,
  paid_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.order_number,o.payment_status,o.order_status,o.fulfilment_status,
         coalesce(o.printrove_status,''),o.courier_name,o.tracking_number,o.tracking_url,
         o.created_at,o.paid_at
  from public.orders o
  where upper(o.order_number)=upper(trim(p_order_number))
    and (
      lower(o.customer_email)=lower(trim(p_contact))
      or o.customer_phone=regexp_replace(p_contact,'[^0-9]','','g')
    )
  limit 1;
$$;

revoke all on function public.track_order(text,text) from public;
grant execute on function public.track_order(text,text) to anon,authenticated;

update public.site_settings
set value = coalesce(value,'{}'::jsonb) || jsonb_build_object(
      'auto_send_to_printrove', true,
      'auto_sync_printrove_on_admin_open', true
    ),
    updated_at = now()
where key = 'commerce';

commit;

-- Expected result: one reconciled order and automation_enabled = true.
select order_number,payment_status,order_status,fulfilment_status,
       printrove_order_id,printrove_status,tracking_number,
       payment_fee,payment_tax,estimated_settlement_amount
from public.orders
where order_number = 'VYR-260704-36B919B4';

select value->>'auto_send_to_printrove' as automation_enabled,
       value->>'auto_sync_printrove_on_admin_open' as automatic_admin_sync
from public.site_settings
where key = 'commerce';

-- This final diagnostic must return zero rows before selling a product.
select name,slug,fulfilment_status,printrove_variant_id,printrove_variant_map
from public.products
where is_published = true
  and (
    fulfilment_status not in ('mapped','ready')
    or (coalesce(printrove_variant_id,'') = '' and coalesce(printrove_variant_map,'{}'::jsonb) = '{}'::jsonb)
  );
