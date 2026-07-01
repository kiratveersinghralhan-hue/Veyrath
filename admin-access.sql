-- VEYRATH admin access helper
-- 1. First create this user in Supabase Dashboard > Authentication > Users:
--    kiratveersinghralhan@gmail.com
-- 2. Set/reset the password only in Supabase Authentication, never in SQL.
-- 3. Run this file in Supabase SQL Editor to grant dashboard access.

begin;

do $$
begin
  if not exists (
    select 1 from auth.users
    where lower(email) = 'kiratveersinghralhan@gmail.com'
  ) then
    raise exception 'Create the Supabase Auth user kiratveersinghralhan@gmail.com first, then run this SQL again.';
  end if;
end
$$;

insert into public.admin_users (user_id, email, is_active)
select id, email, true
from auth.users
where lower(email) = 'kiratveersinghralhan@gmail.com'
on conflict (user_id) do update
set email = excluded.email,
    is_active = true;

commit;

-- Optional verification:
select user_id, email, is_active
from public.admin_users
where lower(email) = 'kiratveersinghralhan@gmail.com';
