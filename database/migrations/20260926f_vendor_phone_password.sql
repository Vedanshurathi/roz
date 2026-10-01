-- Vendor login: registered vendors sign in with phone + password (no OTP / no number
-- verification). First-time vendors still register through the old flow
-- (name + phone → Google → what I sell → vendor_apply) and then create a password once.
-- Changing the password afterwards is a request an admin must approve (same as staff).
--
-- A vendor's password lives on the vendor's own auth user. For a vendor created by an
-- admin that user is <phone>@vendor.rozbazaar.shop; for a Google-registered vendor it is
-- their Google account (Supabase lets an OAuth user also sign in with email + password).
-- vendor_login_lookup(phone) tells the login page which email to sign in with.

create table if not exists public.vendor_password_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  new_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','replaced')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
alter table public.vendor_password_requests enable row level security;   -- RPC access only
revoke all on public.vendor_password_requests from anon, authenticated;
create index if not exists vendor_pw_req_pending on public.vendor_password_requests (vendor_id) where status = 'pending';

-- the vendor row for a typed phone (last 10 digits); prefers approved, then newest
create or replace function public.vendor_by_phone(p_phone text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select v.id from vendors v
   where right(regexp_replace(coalesce(v.phone, ''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
     and length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)) = 10
   order by (v.status = 'approved') desc, (v.auth_user_id is not null) desc, v.created_at desc
   limit 1;
$$;

create or replace function public.vendor_has_password(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select coalesce(encrypted_password, '') <> '' from auth.users where id = p_user), false);
$$;

-- login page: is this number registered, and which email does it sign in with?
create or replace function public.vendor_login_lookup(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare vid uuid; v vendors; em text;
begin
  if length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)) <> 10 then
    return jsonb_build_object('ok', false, 'msg', '10 digit ka phone number daalo');
  end if;
  vid := vendor_by_phone(p_phone);
  if vid is null then return jsonb_build_object('ok', true, 'data', jsonb_build_object('registered', false)); end if;
  select * into v from vendors where id = vid;
  if v.auth_user_id is null or not vendor_has_password(v.auth_user_id) then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('registered', true, 'has_password', false,
      'google', v.auth_user_id is not null));
  end if;
  select email into em from auth.users where id = v.auth_user_id;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('registered', true, 'has_password', true, 'email', em));
end $$;

-- after logging in: does my account have a password yet, and is a change pending?
create or replace function public.vendor_password_status()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare vid uuid; r vendor_password_requests;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  select * into r from vendor_password_requests where vendor_id = vid order by created_at desc limit 1;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'has_password', vendor_has_password(auth.uid()),
    'request', case when r.id is null then null else jsonb_build_object('status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at) end));
end $$;

-- first password only (new registration, or an older Google vendor who never had one)
create or replace function public.vendor_set_first_password(p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_vendor_id() is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  if vendor_has_password(auth.uid()) then
    return jsonb_build_object('ok', false, 'msg', 'Password pehle se bana hai — badalne ke liye Profile me request bhejo');
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = auth.uid();
  return jsonb_build_object('ok', true, 'msg', 'Password ban gaya — ab phone + password se login kar sakte ho');
end $$;

-- change = request; becomes the real password only when an admin approves
create or replace function public.vendor_request_password(p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare vid uuid; nm text; r record;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  update vendor_password_requests set status = 'replaced', decided_at = now() where vendor_id = vid and status = 'pending';
  insert into vendor_password_requests (vendor_id, new_hash) values (vid, extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  select name into nm from vendors where id = vid;
  for r in select auth_user_id from admins loop
    begin
      perform team_notify(r.auth_user_id, 'admin', 'vendor_password', '🔑 ' || coalesce(nm, 'Vendor') || ': password badalna hai',
        'Admin → Vendors me approve / reject karo');
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'msg', 'Request admin ko bhej di — approve hote hi naya password chalega');
end $$;

create or replace function public.admin_vendor_password_requests()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'vendor_id', v.id, 'name', v.name, 'phone', v.phone, 'v_type', v.v_type,
      'status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at)
      order by (r.status = 'pending') desc, r.created_at desc), '[]'::jsonb)
    into res
    from vendor_password_requests r join vendors v on v.id = r.vendor_id
   where r.status = 'pending' or r.created_at > now() - interval '30 days';
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_decide_vendor_password_request(p_request uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r vendor_password_requests; uid uuid;
begin
  perform admin_guard();
  select * into r from vendor_password_requests where id = p_request;
  if r.id is null then return jsonb_build_object('ok', false, 'msg', 'Request nahi mili'); end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'msg', 'Is request pe pehle hi faisla ho chuka'); end if;
  select auth_user_id into uid from vendors where id = r.vendor_id;
  if p_approve then
    if uid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor ka login account nahi juda'); end if;
    update auth.users set encrypted_password = r.new_hash, updated_at = now() where id = uid;
  end if;
  update vendor_password_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = auth.uid()
   where id = p_request;
  if uid is not null then
    perform notify_user(uid, 'vendor', 'password_' || case when p_approve then 'approved' else 'rejected' end,
      case when p_approve then '🔑 Naya password chalu' else '🔑 Password request reject hui' end,
      case when p_approve then 'Ab naye password se login karo' else 'Purana password hi chalega. RozBazaar team se baat karo.' end, null);
  end if;
  perform log_action(case when p_approve then 'vendor_password_approved' else 'vendor_password_rejected' end, 'vendor', r.vendor_id, null);
  return jsonb_build_object('ok', true, 'msg', case when p_approve then 'Approve — naya password ab chalega' else 'Request reject ho gayi' end);
end $$;

-- admin sets / resets a vendor's password directly (now also for Google-registered vendors)
create or replace function public.admin_set_vendor_login(p_vendor uuid, p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v vendors; em text; uid uuid;
begin
  perform admin_guard();
  select * into v from vendors where id = p_vendor;
  if v.id is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  if length(right(regexp_replace(coalesce(v.phone, ''), '\D', '', 'g'), 10)) <> 10 then
    return jsonb_build_object('ok', false, 'msg', 'Vendor ka phone 10 digit ka nahi hai');
  end if;

  if v.auth_user_id is not null then
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = v.auth_user_id;
    update vendor_password_requests set status = 'replaced', decided_at = now() where vendor_id = v.id and status = 'pending';
    perform log_action('vendor_login_set', 'vendor', p_vendor, null);
    return jsonb_build_object('ok', true, 'msg', 'Password set — ' || v.name || ' phone ' || v.phone || ' + naye password se login karega');
  end if;

  em := vendor_login_email(v.phone);
  select id into uid from auth.users where email = em;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
            extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('name', v.name, 'vendor', true), now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), uid::text, uid,
            jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
            'email', now(), now(), null);
  else
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = uid;
  end if;
  update vendors set auth_user_id = uid where id = p_vendor;
  perform log_action('vendor_login_set', 'vendor', p_vendor, null);
  return jsonb_build_object('ok', true, 'msg', v.name || ' ab phone ' || v.phone || ' + password se vendor app me login kar sakta hai');
end $$;

revoke all on function public.vendor_by_phone(text)                          from public, anon, authenticated;
revoke all on function public.vendor_has_password(uuid)                      from public, anon, authenticated;
revoke all on function public.vendor_login_lookup(text)                      from public;
revoke all on function public.vendor_password_status()                       from public, anon;
revoke all on function public.vendor_set_first_password(text)                from public, anon;
revoke all on function public.vendor_request_password(text)                  from public, anon;
revoke all on function public.admin_vendor_password_requests()               from public, anon;
revoke all on function public.admin_decide_vendor_password_request(uuid, boolean) from public, anon;
grant execute on function public.vendor_login_lookup(text) to anon, authenticated;
grant execute on function public.vendor_password_status(), public.vendor_set_first_password(text), public.vendor_request_password(text),
  public.admin_vendor_password_requests(), public.admin_decide_vendor_password_request(uuid, boolean) to authenticated;
