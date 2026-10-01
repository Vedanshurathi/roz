-- Staff roles, staff can rename themselves, and password changes need admin approval.
--  * staff.role — free text the admin sets ("Delivery manager", "Call centre" …)
--  * staff_password_requests — a staff member asks for a new password; only the bcrypt
--    hash is stored; it becomes their real password when an admin approves.
--  * staff_snapshot now includes customer_id so the staff site can group orders per customer.

alter table public.staff add column if not exists role text;

create table if not exists public.staff_password_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  new_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','replaced')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
alter table public.staff_password_requests enable row level security;   -- RPC access only
revoke all on public.staff_password_requests from anon, authenticated;
create index if not exists staff_pw_req_pending on public.staff_password_requests (staff_id) where status = 'pending';

-- signature changes: drop the old one first (see CLAUDE.md lesson 1)
drop function if exists public.admin_add_staff(text, text, text);

create or replace function public.admin_add_staff(p_name text, p_phone text, p_password text, p_role text default null)
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

  insert into staff (auth_user_id, name, phone, role, is_active)
  values (uid, trim(p_name), ph, nullif(trim(coalesce(p_role, '')), ''), true)
  on conflict (auth_user_id) do update set name = excluded.name, phone = excluded.phone,
                                           role = excluded.role, is_active = true;

  perform log_action('staff_added', 'staff', uid, jsonb_build_object('phone', ph));
  return jsonb_build_object('ok', true, 'msg', trim(p_name) || ' staff me jud gaya');
end $$;

create or replace function public.admin_update_staff(p_staff uuid, p_name text, p_role text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Naam daalo'); end if;
  update staff set name = trim(p_name), role = nullif(trim(coalesce(p_role, '')), '') where id = p_staff;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Staff nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Staff update ho gaya');
end $$;

create or replace function public.admin_staff_list()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'role', s.role, 'is_active', s.is_active,
      'created_at', s.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'pending_request', exists (select 1 from staff_password_requests r where r.staff_id = s.id and r.status = 'pending'))
      order by s.created_at desc), '[]'::jsonb)
    into res
    from staff s left join auth.users u on u.id = s.auth_user_id;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_password_requests()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'staff_id', s.id, 'name', s.name, 'phone', s.phone, 'role', s.role,
      'status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at)
      order by (r.status = 'pending') desc, r.created_at desc), '[]'::jsonb)
    into res
    from staff_password_requests r join staff s on s.id = r.staff_id
   where r.status = 'pending' or r.created_at > now() - interval '30 days';
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_decide_password_request(p_request uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r staff_password_requests; uid uuid;
begin
  perform admin_guard();
  select * into r from staff_password_requests where id = p_request;
  if r.id is null then return jsonb_build_object('ok', false, 'msg', 'Request nahi mili'); end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'msg', 'Is request pe pehle hi faisla ho chuka'); end if;
  if p_approve then
    select auth_user_id into uid from staff where id = r.staff_id;
    update auth.users set encrypted_password = r.new_hash, updated_at = now() where id = uid;
  end if;
  update staff_password_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = auth.uid()
   where id = p_request;
  perform log_action(case when p_approve then 'staff_password_approved' else 'staff_password_rejected' end, 'staff', r.staff_id, null);
  return jsonb_build_object('ok', true, 'msg', case when p_approve then 'Approve — naya password ab chalega' else 'Request reject ho gayi' end);
end $$;

-- staff side
create or replace function public.staff_me()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s staff;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;
  select * into s from staff where auth_user_id = auth.uid();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'name', coalesce(s.name, 'Admin'), 'phone', s.phone, 'role', s.role, 'is_admin', is_admin()));
end $$;

create or replace function public.staff_update_my_name(p_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 60 then
    return jsonb_build_object('ok', false, 'msg', 'Sahi naam daalo');
  end if;
  update staff set name = trim(p_name) where auth_user_id = auth.uid() and is_active;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Naam badal gaya');
end $$;

create or replace function public.staff_request_password(p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid;
begin
  select id into sid from staff where auth_user_id = auth.uid() and is_active;
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  update staff_password_requests set status = 'replaced', decided_at = now() where staff_id = sid and status = 'pending';
  insert into staff_password_requests (staff_id, new_hash) values (sid, extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  return jsonb_build_object('ok', true, 'msg', 'Request admin ko bhej di — approve hote hi naya password chalega');
end $$;

create or replace function public.staff_password_status()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r staff_password_requests;
begin
  select pr.* into r from staff_password_requests pr join staff s on s.id = pr.staff_id
   where s.auth_user_id = auth.uid() and pr.status <> 'replaced' order by pr.created_at desc limit 1;
  if r.id is null then return jsonb_build_object('ok', true, 'data', null); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at));
end $$;

-- staff_snapshot: same as before plus customer_id
create or replace function public.staff_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;

  select jsonb_build_object(
    'today', ist_date(),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'code', b.code, 'booking_date', b.booking_date, 'slot', b.slot,
        'status', b.status, 'v_type', b.v_type, 'area', b.area, 'landmark', b.landmark,
        'customer_id', b.customer_id, 'customer_name', b.customer_name, 'customer_phone', b.customer_phone,
        'vendor_id', b.vendor_id, 'vendor_name', b.vendor_name,
        'est_total', b.est_total, 'final_total', b.final_total,
        'pay_method', b.pay_method, 'pay_amount', b.pay_amount, 'created_at', b.created_at,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', bi.product_name, 'unit', bi.unit, 'qty', bi.qty,
                    'price_at_booking', bi.price_at_booking,
                    'final_qty', bi.final_qty, 'final_price', bi.final_price,
                    'removed', coalesce(bi.removed, false)) order by bi.id), '[]'::jsonb)
                  from booking_items bi where bi.booking_id = b.id)
      ) order by b.booking_date desc, b.slot)
      from booking_full b
      where b.booking_date >= ist_date() - 90), '[]'::jsonb),
    'vendors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'name', v.name, 'shop_name', v.shop_name, 'phone', v.phone,
        'v_type', v.v_type, 'areas_served', v.areas_served, 'status', v.status,
        'is_active', v.is_active, 'avg_rating', v.avg_rating, 'total_ratings', v.total_ratings
      ) order by v.name)
      from vendors v), '[]'::jsonb)
  ) into res;

  return jsonb_build_object('ok', true, 'data', res);
end $$;

revoke all on function public.admin_add_staff(text, text, text, text)         from public, anon;
revoke all on function public.admin_update_staff(uuid, text, text)            from public, anon;
revoke all on function public.admin_password_requests()                       from public, anon;
revoke all on function public.admin_decide_password_request(uuid, boolean)    from public, anon;
revoke all on function public.staff_update_my_name(text)                      from public, anon;
revoke all on function public.staff_request_password(text)                    from public, anon;
revoke all on function public.staff_password_status()                         from public, anon;
grant execute on function public.admin_add_staff(text, text, text, text)      to authenticated;
grant execute on function public.admin_update_staff(uuid, text, text)         to authenticated;
grant execute on function public.admin_password_requests()                    to authenticated;
grant execute on function public.admin_decide_password_request(uuid, boolean) to authenticated;
grant execute on function public.staff_update_my_name(text)                   to authenticated;
grant execute on function public.staff_request_password(text)                 to authenticated;
grant execute on function public.staff_password_status()                      to authenticated;
