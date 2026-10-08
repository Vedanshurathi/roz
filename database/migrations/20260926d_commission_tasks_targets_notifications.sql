-- Commission setting, sales vs intern staff, tasks, sales targets, team notifications.
--  * app_settings.commission_rate (percent, default 10). Customers still pay vendors
--    directly, so "platform revenue" = commission DUE from vendors on GMV, not money
--    the app collects. admin_finance_dashboard now reports it.
--  * staff.kind: 'sales' (sees business data) or 'intern' (sees only own tasks).
--    staff_snapshot() is sales/admin only — interns are refused by the database.
--  * staff_tasks: admin assigns work to sales or interns; they mark done / not done.
--  * sales_targets: admin sets a sale target (amount, category, period) for one sales
--    person or the whole sales team; progress is computed live from bookings/payments.
--  * Notifications (in-app row + web push through the existing send-push function,
--    via notify_bi): new task → assignee; new target → sales; task finished → admins;
--    new order / customer / vendor → admins + active sales (never interns).

-- ---------- commission ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('commission_rate', '10'::jsonb)
on conflict (key) do nothing;

create or replace function public.commission_rate()
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value #>> '{}')::numeric from app_settings where key = 'commission_rate'), 0);
$$;

create or replace function public.admin_settings()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'commission_rate', commission_rate(),
    'commission_updated_at', (select updated_at from app_settings where key = 'commission_rate')));
end $$;

create or replace function public.admin_set_commission(p_rate numeric)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare old numeric := commission_rate();
begin
  perform admin_guard();
  if p_rate is null or p_rate < 0 or p_rate > 50 then
    return jsonb_build_object('ok', false, 'msg', 'Commission 0 se 50% ke beech rakho');
  end if;
  insert into app_settings (key, value, updated_at, updated_by) values ('commission_rate', to_jsonb(round(p_rate, 2)), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform log_action('commission_changed', 'settings', null, jsonb_build_object('from', old, 'to', round(p_rate, 2)));
  return jsonb_build_object('ok', true, 'msg', 'Commission ab ' || round(p_rate, 2) || '% hai');
end $$;

-- ---------- staff kind ----------
alter table public.staff add column if not exists kind text not null default 'sales';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_kind_check') then
    alter table public.staff add constraint staff_kind_check check (kind in ('sales', 'intern'));
  end if;
end $$;

create or replace function public.is_sales()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select is_admin() or exists (select 1 from staff where auth_user_id = auth.uid() and is_active and kind = 'sales');
$$;
create or replace function public.my_staff_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from staff where auth_user_id = auth.uid() and is_active;
$$;

-- one place that sends a team notification: in-app row + phone push (notify_bi → send-push)
create or replace function public.team_notify(p_user uuid, p_role text, p_type text, p_title text, p_msg text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null then return; end if;
  perform notify_bi(p_user, p_role, p_type, p_title, p_title, p_msg, p_msg, null);
exception when others then
  -- a notification must never break the action that caused it
  raise warning 'team_notify failed: %', sqlerrm;
end $$;

-- admins (role 'admin') + active sales staff (role 'staff'); interns never get these
create or replace function public.notify_ops(p_type text, p_title text, p_msg text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in select auth_user_id from admins loop
    perform team_notify(r.auth_user_id, 'admin', p_type, p_title, p_msg);
  end loop;
  for r in select auth_user_id from staff where is_active and kind = 'sales' loop
    perform team_notify(r.auth_user_id, 'staff', p_type, p_title, p_msg);
  end loop;
end $$;

-- staff signatures change again: drop first (CLAUDE.md lesson 1)
drop function if exists public.admin_add_staff(text, text, text, text);
drop function if exists public.admin_update_staff(uuid, text, text);

create or replace function public.admin_add_staff(p_name text, p_phone text, p_password text, p_role text default null, p_kind text default 'sales')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare ph text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
        em text; uid uuid; k text := coalesce(nullif(p_kind, ''), 'sales');
begin
  perform admin_guard();
  if length(ph) <> 10 then return jsonb_build_object('ok', false, 'msg', '10 digit phone number daalo'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Naam daalo'); end if;
  if k not in ('sales', 'intern') then return jsonb_build_object('ok', false, 'msg', 'Type sales ya intern hona chahiye'); end if;
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

  insert into staff (auth_user_id, name, phone, role, kind, is_active)
  values (uid, trim(p_name), ph, nullif(trim(coalesce(p_role, '')), ''), k, true)
  on conflict (auth_user_id) do update set name = excluded.name, phone = excluded.phone,
                                           role = excluded.role, kind = excluded.kind, is_active = true;

  perform log_action('staff_added', 'staff', uid, jsonb_build_object('phone', ph, 'kind', k));
  return jsonb_build_object('ok', true, 'msg', trim(p_name) || ' ' || case k when 'intern' then 'intern' else 'sales team' end || ' me jud gaya');
end $$;

create or replace function public.admin_update_staff(p_staff uuid, p_name text, p_role text, p_kind text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Naam daalo'); end if;
  if p_kind is not null and p_kind not in ('sales', 'intern') then return jsonb_build_object('ok', false, 'msg', 'Type sales ya intern hona chahiye'); end if;
  update staff set name = trim(p_name), role = nullif(trim(coalesce(p_role, '')), ''), kind = coalesce(p_kind, kind) where id = p_staff;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Staff nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Staff update ho gaya');
end $$;

create or replace function public.admin_staff_list()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'role', s.role, 'kind', s.kind, 'is_active', s.is_active,
      'created_at', s.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'pending_request', exists (select 1 from staff_password_requests r where r.staff_id = s.id and r.status = 'pending'),
      'tasks_open', (select count(*) from staff_tasks t where t.staff_id = s.id and t.status = 'todo'),
      'tasks_done', (select count(*) from staff_tasks t where t.staff_id = s.id and t.status = 'done'))
      order by s.created_at desc), '[]'::jsonb)
    into res
    from staff s left join auth.users u on u.id = s.auth_user_id;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.staff_me()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s staff;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;
  select * into s from staff where auth_user_id = auth.uid();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', s.id, 'name', coalesce(s.name, 'Admin'), 'phone', s.phone, 'role', s.role,
    'kind', case when s.id is null then 'sales' else s.kind end,
    'joined', s.created_at, 'is_admin', is_admin()));
end $$;

-- ---------- tasks ----------
create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  title text not null,
  details text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'done', 'not_done')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid
);
alter table public.staff_tasks enable row level security;
revoke all on public.staff_tasks from anon, authenticated;
create index if not exists staff_tasks_staff on public.staff_tasks (staff_id, status);

create or replace function public.admin_tasks()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'staff_id', t.staff_id, 'staff_name', s.name, 'staff_kind', s.kind,
      'title', t.title, 'details', t.details, 'priority', t.priority, 'due_date', t.due_date,
      'status', t.status, 'staff_note', t.staff_note, 'created_at', t.created_at,
      'updated_at', t.updated_at, 'completed_at', t.completed_at)
      order by (t.status = 'todo') desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t join staff s on s.id = t.staff_id;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_add_task(p_staff uuid[], p_title text, p_details text default null,
                                                 p_priority text default 'normal', p_due date default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid; n int := 0; s staff; pr text := coalesce(nullif(p_priority, ''), 'normal');
begin
  perform admin_guard();
  if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Kaam ka title likho'); end if;
  if coalesce(array_length(p_staff, 1), 0) = 0 then return jsonb_build_object('ok', false, 'msg', 'Kam se kam ek staff chuno'); end if;
  if pr not in ('low', 'normal', 'high') then pr := 'normal'; end if;
  foreach sid in array p_staff loop
    select * into s from staff where id = sid and is_active;
    continue when s.id is null;
    insert into staff_tasks (staff_id, title, details, priority, due_date, created_by)
    values (sid, trim(p_title), nullif(trim(coalesce(p_details, '')), ''), pr, p_due, auth.uid());
    perform team_notify(s.auth_user_id, 'staff', 'task_new',
      case when pr = 'high' then '🔴 Naya zaroori kaam' else '📝 Naya kaam mila' end,
      trim(p_title) || coalesce(' — ' || to_char(p_due, 'DD Mon') || ' tak', ''));
    n := n + 1;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'msg', 'Koi chalu staff nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', n || ' logon ko kaam de diya — unhe notification gaya');
end $$;

create or replace function public.admin_update_task(p_task uuid, p_title text, p_details text, p_priority text, p_due date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Kaam ka title likho'); end if;
  update staff_tasks set title = trim(p_title), details = nullif(trim(coalesce(p_details, '')), ''),
         priority = case when p_priority in ('low', 'normal', 'high') then p_priority else priority end,
         due_date = p_due, updated_at = now()
   where id = p_task;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Kaam update ho gaya');
end $$;

create or replace function public.admin_reopen_task(p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t staff_tasks;
begin
  perform admin_guard();
  update staff_tasks set status = 'todo', completed_at = null, updated_at = now() where id = p_task returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  perform team_notify((select auth_user_id from staff where id = t.staff_id), 'staff', 'task_reopen', '↩️ Kaam dobara khula', t.title);
  return jsonb_build_object('ok', true, 'msg', 'Kaam dobara khul gaya');
end $$;

create or replace function public.admin_delete_task(p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  delete from staff_tasks where id = p_task;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Kaam hata diya');
end $$;

create or replace function public.staff_my_tasks()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare sid uuid := my_staff_id(); res jsonb;
begin
  if sid is null then return jsonb_build_object('ok', true, 'data', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'details', t.details, 'priority', t.priority, 'due_date', t.due_date,
      'status', t.status, 'staff_note', t.staff_note, 'created_at', t.created_at, 'completed_at', t.completed_at)
      order by (t.status = 'todo') desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t where t.staff_id = sid;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.staff_set_task_status(p_task uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid := my_staff_id(); t staff_tasks; who text; r record;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai'); end if;
  if p_status not in ('todo', 'done', 'not_done') then return jsonb_build_object('ok', false, 'msg', 'Galat status'); end if;
  if p_status = 'not_done' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'msg', 'Kyun nahi hua — thoda likho');
  end if;
  update staff_tasks set status = p_status, staff_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), staff_note),
         completed_at = case when p_status = 'done' then now() else null end, updated_at = now()
   where id = p_task and staff_id = sid returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  if p_status in ('done', 'not_done') then
    select name into who from staff where id = sid;
    for r in select auth_user_id from admins loop
      perform team_notify(r.auth_user_id, 'admin', 'task_' || p_status,
        case when p_status = 'done' then '✅ ' || who || ' ne kaam pura kiya' else '⚠️ ' || who || ': kaam nahi hua' end,
        t.title || coalesce(' — ' || t.staff_note, ''));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', case p_status when 'done' then 'Shabaash! Kaam complete ✓'
                                                             when 'not_done' then 'Admin ko bata diya' else 'Kaam wapas baaki me' end);
end $$;

-- ---------- sales targets ----------
create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,   -- null = whole sales team
  v_type text check (v_type is null or v_type in ('vegetable', 'fruit', 'onion_potato')),   -- null = all types
  amount numeric(12,2) not null check (amount > 0),
  start_date date not null,
  end_date date not null,
  title text,
  created_at timestamptz not null default now(),
  created_by uuid,
  check (end_date >= start_date)
);
alter table public.sales_targets enable row level security;
revoke all on public.sales_targets from anon, authenticated;

-- same "sale" definition as every dashboard: a payment exists, or status paid/delivered/completed
create or replace function public.target_achieved(p_type text, p_from date, p_to date)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(coalesce(p.amount, b.final_total, b.est_total)), 0)
    from bookings b left join payments p on p.booking_id = b.id
   where b.booking_date between p_from and p_to
     and (p_type is null or b.v_type::text = p_type)
     and (p.id is not null or b.status in ('paid', 'delivered', 'completed'));
$$;

create or replace function public.targets_json(p_staff uuid, p_all boolean)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'staff_id', t.staff_id, 'staff_name', s.name, 'v_type', t.v_type, 'amount', t.amount,
      'start_date', t.start_date, 'end_date', t.end_date, 'title', t.title, 'created_at', t.created_at,
      'achieved', target_achieved(t.v_type, t.start_date, t.end_date),
      'achieved_today', target_achieved(t.v_type, ist_date(), ist_date()),
      'today', ist_date())
      order by (t.end_date >= ist_date()) desc, t.end_date, t.created_at desc), '[]'::jsonb)
    from sales_targets t left join staff s on s.id = t.staff_id
   where p_all or t.staff_id is null or t.staff_id = p_staff;
$$;

create or replace function public.admin_targets()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', targets_json(null, true));
end $$;

create or replace function public.staff_my_targets()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_sales() then return jsonb_build_object('ok', false, 'msg', 'Targets sirf sales team ke liye'); end if;
  return jsonb_build_object('ok', true, 'data', targets_json(my_staff_id(), false));
end $$;

create or replace function public.admin_add_target(p_staff uuid, p_type text, p_amount numeric, p_start date, p_end date, p_title text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; label text;
begin
  perform admin_guard();
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'msg', 'Target amount daalo'); end if;
  if p_start is null or p_end is null or p_end < p_start then return jsonb_build_object('ok', false, 'msg', 'Sahi dates chuno'); end if;
  if p_type is not null and p_type not in ('vegetable', 'fruit', 'onion_potato') then return jsonb_build_object('ok', false, 'msg', 'Galat type'); end if;
  if p_staff is not null and not exists (select 1 from staff where id = p_staff and kind = 'sales') then
    return jsonb_build_object('ok', false, 'msg', 'Target sirf sales staff ko de sakte ho');
  end if;
  insert into sales_targets (staff_id, v_type, amount, start_date, end_date, title, created_by)
  values (p_staff, p_type, round(p_amount, 2), p_start, p_end, nullif(trim(coalesce(p_title, '')), ''), auth.uid());
  label := '₹' || to_char(p_amount, 'FM99,99,99,999') || ' ' ||
           case p_type when 'vegetable' then 'sabzi' when 'fruit' then 'fruits' when 'onion_potato' then 'pyaaz-aloo' else '' end ||
           ' sale — ' || to_char(p_start, 'DD Mon') || ' se ' || to_char(p_end, 'DD Mon') || ' tak';
  for r in select auth_user_id from staff where is_active and kind = 'sales' and (p_staff is null or id = p_staff) loop
    perform team_notify(r.auth_user_id, 'staff', 'target_new', '🎯 Naya target', label);
  end loop;
  return jsonb_build_object('ok', true, 'msg', 'Target set — sales team ko notification gaya');
end $$;

create or replace function public.admin_delete_target(p_target uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  delete from sales_targets where id = p_target;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Target nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Target hata diya');
end $$;

-- ---------- team notifications (in-app list, push subscription) ----------
create or replace function public.team_notifications(p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Login karo'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'title', coalesce(n.title_en, n.title),
      'message', coalesce(n.message_en, n.message), 'is_read', n.is_read, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
    into res
    from (select * from notifications where user_id = auth.uid() and role in ('staff', 'admin')
          order by created_at desc limit least(greatest(p_limit, 1), 100)) n;
  return jsonb_build_object('ok', true, 'data', res,
    'unread', (select count(*) from notifications where user_id = auth.uid() and role in ('staff', 'admin') and not is_read));
end $$;

create or replace function public.team_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update notifications set is_read = true
   where user_id = auth.uid() and role in ('staff', 'admin') and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.team_save_push(p_app text, p_endpoint text, p_p256dh text, p_auth text, p_agent text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_app = 'admin' and not is_admin() then return jsonb_build_object('ok', false, 'msg', 'Sirf admin'); end if;
  if p_app = 'staff' and my_staff_id() is null then return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai'); end if;
  if p_app not in ('admin', 'staff') or coalesce(p_endpoint, '') = '' then return jsonb_build_object('ok', false, 'msg', 'Galat request'); end if;
  insert into push_subscriptions (user_id, role, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), p_app, p_endpoint, p_p256dh, p_auth, left(p_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, role = excluded.role, p256dh = excluded.p256dh,
                                       auth_key = excluded.auth_key, is_active = true, last_seen = now();
  return jsonb_build_object('ok', true, 'msg', 'Notifications chalu ✓');
end $$;

-- ---------- ops alerts: new order / customer / vendor ----------
create or replace function public.tg_ops_new_booking()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare a text; c text;
begin
  if new.schedule_id is not null then return new; end if;   -- recurring orders spawned at 01:30 — no night alerts
  select area into a from addresses where id = new.address_id;
  select name into c from customers where id = new.customer_id;
  perform notify_ops('ops_new_order', '🛒 Naya order ' || coalesce(new.code, ''),
    coalesce(c, 'Customer') || ' · ' || coalesce(a, '') || ' · ' ||
    case new.slot when 'morning' then 'Subah' when 'afternoon' then 'Dopahar' else 'Shaam' end || ' ' || to_char(new.booking_date, 'DD Mon'));
  return new;
exception when others then
  raise warning 'tg_ops_new_booking: %', sqlerrm; return new;
end $$;

create or replace function public.tg_ops_new_customer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform notify_ops('ops_new_customer', '👤 Naya customer juda', coalesce(nullif(new.name, ''), 'Naam abhi nahi') || coalesce(' · ' || new.phone, ''));
  return new;
exception when others then
  raise warning 'tg_ops_new_customer: %', sqlerrm; return new;
end $$;

create or replace function public.tg_ops_new_vendor()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform notify_ops('ops_new_vendor', '🧑‍🌾 Naya vendor ' || case when new.status = 'pending' then '— approval chahiye' else 'juda' end,
    new.name || ' · ' || case new.v_type when 'vegetable' then 'Sabzi' when 'fruit' then 'Fruits' else 'Pyaaz-Aloo' end ||
    coalesce(' · ' || array_to_string(new.areas_served, ', '), ''));
  return new;
exception when others then
  raise warning 'tg_ops_new_vendor: %', sqlerrm; return new;
end $$;

drop trigger if exists trg_ops_new_booking on public.bookings;
create trigger trg_ops_new_booking after insert on public.bookings for each row execute function public.tg_ops_new_booking();
drop trigger if exists trg_ops_new_customer on public.customers;
create trigger trg_ops_new_customer after insert on public.customers for each row execute function public.tg_ops_new_customer();
drop trigger if exists trg_ops_new_vendor on public.vendors;
create trigger trg_ops_new_vendor after insert on public.vendors for each row execute function public.tg_ops_new_vendor();

-- ---------- business data: sales + admin only ----------
create or replace function public.staff_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  if not is_sales() then   -- interns and strangers get nothing
    return jsonb_build_object('ok', false, 'msg', 'Ye data sirf sales team ke liye hai');
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

-- ---------- finance dashboard reports commission due ----------
CREATE OR REPLACE FUNCTION public.admin_finance_dashboard(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
  gmv_today numeric; gmv_yesterday numeric; gmv_week numeric; gmv_prev_week numeric;
  gmv_month numeric; gmv_all numeric;
  orders_today int; orders_completed_period int; orders_total_period int;
  aov numeric; cash_total numeric; upi_total numeric;
  trend jsonb; top_vendors jsonb; active_vendors int; active_customers_period int;
begin
  perform admin_guard();

  select coalesce(sum(p.amount),0) into gmv_today
    from payments p join bookings b on b.id=p.booking_id where b.booking_date=current_date;
  select coalesce(sum(p.amount),0) into gmv_yesterday
    from payments p join bookings b on b.id=p.booking_id where b.booking_date=current_date-1;
  select coalesce(sum(p.amount),0) into gmv_week
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date-6;
  select coalesce(sum(p.amount),0) into gmv_prev_week
    from payments p join bookings b on b.id=p.booking_id
    where b.booking_date >= current_date-13 and b.booking_date <= current_date-7;
  select coalesce(sum(p.amount),0) into gmv_month
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date-29;
  select coalesce(sum(amount),0) into gmv_all from payments;

  select count(*) into orders_today from bookings where booking_date=current_date;
  select count(*) filter (where status='completed'), count(*) into orders_completed_period, orders_total_period
    from bookings where booking_date >= current_date - p_days;

  select case when count(*)=0 then 0 else round(avg(amount),0) end into aov
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date - p_days;

  -- real enum values are cash / upi_direct / online — grouping the
  -- latter two together as "digital" for a clean two-way split
  select coalesce(sum(amount) filter (where method='cash'),0),
         coalesce(sum(amount) filter (where method in ('upi_direct','online')),0)
    into cash_total, upi_total
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date - p_days;

  select count(distinct vendor_id) into active_vendors
    from bookings where booking_date >= current_date - p_days and status='completed';
  select count(distinct customer_id) into active_customers_period
    from bookings where booking_date >= current_date - p_days and status='completed';

  select coalesce(jsonb_agg(jsonb_build_object(
           'd', d, 'gmv', gmv, 'orders', orders) order by d), '[]'::jsonb)
    into trend
    from (
      select gs::date as d,
        (select coalesce(sum(p.amount),0) from payments p join bookings b on b.id=p.booking_id
          where b.booking_date=gs::date) as gmv,
        (select count(*) from bookings where booking_date=gs::date and status='completed') as orders
      from generate_series(current_date - (p_days-1), current_date, interval '1 day') gs
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', v.name, 'gmv', vg.gmv, 'orders', vg.orders) order by vg.gmv desc), '[]'::jsonb)
    into top_vendors
    from (
      select b.vendor_id, sum(p.amount) as gmv, count(distinct b.id) as orders
        from payments p join bookings b on b.id=p.booking_id
       where b.booking_date >= current_date - p_days
       group by b.vendor_id
       order by sum(p.amount) desc limit 5
    ) vg
    join vendors v on v.id = vg.vendor_id;

  res := jsonb_build_object(
    'gmv_today', gmv_today, 'gmv_yesterday', gmv_yesterday,
    'gmv_week', gmv_week, 'gmv_prev_week', gmv_prev_week,
    'gmv_month', gmv_month, 'gmv_all', gmv_all,
    'orders_today', orders_today,
    'orders_completed_period', orders_completed_period, 'orders_total_period', orders_total_period,
    'aov', aov, 'cash_total', cash_total, 'upi_total', upi_total,
    'active_vendors', active_vendors, 'active_customers_period', active_customers_period,
    'platform_revenue', round(gmv_month * commission_rate() / 100, 2),
    'platform_revenue_all', round(gmv_all * commission_rate() / 100, 2), 'commission_rate', commission_rate(),
    'trend', trend, 'top_vendors', top_vendors, 'period_days', p_days
  );
  return jsonb_build_object('ok', true, 'data', res);
end $function$;

-- ---------- privileges ----------
revoke all on function public.commission_rate()                                   from public, anon, authenticated;
revoke all on function public.team_notify(uuid, text, text, text, text)            from public, anon, authenticated;
revoke all on function public.notify_ops(text, text, text)                         from public, anon, authenticated;
revoke all on function public.target_achieved(text, date, date)                    from public, anon, authenticated;
revoke all on function public.targets_json(uuid, boolean)                          from public, anon, authenticated;
revoke all on function public.tg_ops_new_booking()                                 from public, anon, authenticated;
revoke all on function public.tg_ops_new_customer()                                from public, anon, authenticated;
revoke all on function public.tg_ops_new_vendor()                                  from public, anon, authenticated;
revoke all on function public.is_sales()                                           from public, anon;
revoke all on function public.my_staff_id()                                        from public, anon;
revoke all on function public.admin_settings()                                     from public, anon;
revoke all on function public.admin_set_commission(numeric)                        from public, anon;
revoke all on function public.admin_add_staff(text, text, text, text, text)        from public, anon;
revoke all on function public.admin_update_staff(uuid, text, text, text)           from public, anon;
revoke all on function public.admin_tasks()                                        from public, anon;
revoke all on function public.admin_add_task(uuid[], text, text, text, date)       from public, anon;
revoke all on function public.admin_update_task(uuid, text, text, text, date)      from public, anon;
revoke all on function public.admin_reopen_task(uuid)                              from public, anon;
revoke all on function public.admin_delete_task(uuid)                              from public, anon;
revoke all on function public.staff_my_tasks()                                     from public, anon;
revoke all on function public.staff_set_task_status(uuid, text, text)              from public, anon;
revoke all on function public.admin_targets()                                      from public, anon;
revoke all on function public.staff_my_targets()                                   from public, anon;
revoke all on function public.admin_add_target(uuid, text, numeric, date, date, text) from public, anon;
revoke all on function public.admin_delete_target(uuid)                            from public, anon;
revoke all on function public.team_notifications(int)                              from public, anon;
revoke all on function public.team_mark_read(uuid)                                 from public, anon;
revoke all on function public.team_save_push(text, text, text, text, text)         from public, anon;
revoke all on function public.admin_finance_dashboard(integer)                     from public, anon;
grant execute on function public.is_sales(), public.my_staff_id(), public.admin_settings(), public.admin_set_commission(numeric),
  public.admin_add_staff(text, text, text, text, text), public.admin_update_staff(uuid, text, text, text),
  public.admin_tasks(), public.admin_add_task(uuid[], text, text, text, date), public.admin_update_task(uuid, text, text, text, date),
  public.admin_reopen_task(uuid), public.admin_delete_task(uuid), public.staff_my_tasks(), public.staff_set_task_status(uuid, text, text),
  public.admin_targets(), public.staff_my_targets(), public.admin_add_target(uuid, text, numeric, date, date, text), public.admin_delete_target(uuid),
  public.team_notifications(int), public.team_mark_read(uuid), public.team_save_push(text, text, text, text, text),
  public.admin_finance_dashboard(integer)
  to authenticated;
