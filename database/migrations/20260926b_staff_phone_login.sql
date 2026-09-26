-- Staff log in with PHONE + password on the staff website.
-- Supabase phone auth needs an SMS provider, so each employee gets a normal
-- email/password auth user with a synthetic address: <10-digit phone>@staff.rozbazaar.shop.
-- The staff site turns the typed phone into that address. Admins manage staff
-- from the admin console through the admin_*staff* RPCs below.

create or replace function public.staff_login_email(p_phone text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10) || '@staff.rozbazaar.shop';
$$;

create or replace function public.admin_staff_list()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'is_active', s.is_active,
      'created_at', s.created_at, 'last_sign_in_at', u.last_sign_in_at) order by s.created_at desc), '[]'::jsonb)
    into res
    from staff s left join auth.users u on u.id = s.auth_user_id;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_add_staff(p_name text, p_phone text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare ph text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
        em text; uid uuid;
begin
  perform admin_guard();
  if length(ph) <> 10 then return jsonb_build_object('ok', false, 'msg', '10 digit phone number daalo'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Naam daalo'); end if;
  em := staff_login_email(ph);

  select id into uid from auth.users where email = em;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
            extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('name', trim(p_name), 'staff', true), now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), uid::text, uid,
            jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
            'email', now(), now(), null);
  else
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
                          email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = uid;
  end if;

  insert into staff (auth_user_id, name, phone, is_active) values (uid, trim(p_name), ph, true)
  on conflict (auth_user_id) do update set name = excluded.name, phone = excluded.phone, is_active = true;

  perform log_action('staff_added', 'staff', uid, jsonb_build_object('phone', ph));
  return jsonb_build_object('ok', true, 'msg', trim(p_name) || ' staff me jud gaya');
end $$;

create or replace function public.admin_set_staff_active(p_staff uuid, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  update staff set is_active = p_active where id = p_staff;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Staff nahi mila'); end if;
  perform log_action(case when p_active then 'staff_enabled' else 'staff_disabled' end, 'staff', p_staff, null);
  return jsonb_build_object('ok', true, 'msg', case when p_active then 'Staff chalu' else 'Staff band — ab login nahi kar payega' end);
end $$;

create or replace function public.admin_reset_staff_password(p_staff uuid, p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid;
begin
  perform admin_guard();
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  select auth_user_id into uid from staff where id = p_staff;
  if uid is null then return jsonb_build_object('ok', false, 'msg', 'Staff nahi mila'); end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = uid;
  perform log_action('staff_password_reset', 'staff', p_staff, null);
  return jsonb_build_object('ok', true, 'msg', 'Naya password set ho gaya');
end $$;

-- staff_me now also returns the phone
create or replace function public.staff_me()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s staff;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;
  select * into s from staff where auth_user_id = auth.uid();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'name', coalesce(s.name, 'Admin'), 'phone', s.phone, 'is_admin', is_admin()));
end $$;

revoke all on function public.admin_staff_list()                      from public, anon;
revoke all on function public.admin_add_staff(text, text, text)       from public, anon;
revoke all on function public.admin_set_staff_active(uuid, boolean)   from public, anon;
revoke all on function public.admin_reset_staff_password(uuid, text)  from public, anon;
grant execute on function public.admin_staff_list()                     to authenticated;
grant execute on function public.admin_add_staff(text, text, text)      to authenticated;
grant execute on function public.admin_set_staff_active(uuid, boolean)  to authenticated;
grant execute on function public.admin_reset_staff_password(uuid, text) to authenticated;

-- the first employee (password is temporary — change it from the staff site)
-- applied separately as admin: select admin_add_staff('Staff', '7082696504', '<temp>');
