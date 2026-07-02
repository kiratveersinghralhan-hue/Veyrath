-- VEYRATH one-time Supabase Auth password reset
-- Run this ONLY in the VEYRATH Supabase project SQL Editor.
-- Replace ONLY the text between the quotes on the v_new_password line.
-- Do not upload this file to GitHub after putting a real password inside it.

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := '3fe82a7a-b3a5-4659-a2ba-792e27abd23a';
  v_email text := 'kiratveersinghralhan@gmail.com';
  -- EDIT ONLY THIS LINE:
  v_new_password text := 'PASTE_YOUR_NEW_PASSWORD_HERE';
  v_rows integer;
begin
  if v_new_password = 'PASTE_YOUR_NEW_PASSWORD_HERE' then
    raise exception 'You did not replace the password placeholder. Edit only the quoted password value.';
  end if;

  if length(v_new_password) < 8 then
    raise exception 'Password must be at least 8 characters.';
  end if;

  update auth.users
  set encrypted_password = crypt(v_new_password, gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      aud = coalesce(aud, 'authenticated'),
      role = coalesce(role, 'authenticated'),
      updated_at = now()
  where id = v_user_id
    and lower(email) = lower(v_email);

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception 'No matching Auth user found for % with id %. Check you are in the VEYRATH Supabase project.', v_email, v_user_id;
  end if;

  insert into public.admin_users (user_id, email, is_active)
  values (v_user_id, v_email, true)
  on conflict (user_id) do update
  set email = excluded.email,
      is_active = true,
      updated_at = now();
end
$$;

commit;

select
  u.id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  a.is_active as admin_active
from auth.users u
left join public.admin_users a on a.user_id = u.id
where u.id = '3fe82a7a-b3a5-4659-a2ba-792e27abd23a';
