-- Notification delivery + open tracking, shown per person (name + phone) in admin.
--
--  notifications gets:
--    push_devices / push_sent / push_failed / push_at  — written by the send-push edge function
--        (how many of the person's phones it was sent to; 0 devices = the person never allowed alerts)
--    delivered_at — the phone's service worker reported the push arrived on the phone
--    opened_at    — the person tapped the notification
--    read_at      — the person saw it in the app's 🔔 list (the *_mark_read functions)
--    broadcast_id — which admin broadcast it belongs to
--  push goes through push_note(notification id) so the edge function knows which row to update and
--  the phone can report back with notification_track(id, 'delivered'|'opened') (callable without login:
--  the service worker has no session; the id is a random uuid and only these timestamps can be set).

alter table public.notifications
  add column if not exists push_devices int,
  add column if not exists push_sent int,
  add column if not exists push_failed int,
  add column if not exists push_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists broadcast_id uuid;
create index if not exists notifications_broadcast_idx on public.notifications (broadcast_id);
create index if not exists notifications_created_idx on public.notifications (created_at desc);

-- send one notification row as a push (title/body in the person's language)
create or replace function public.push_note(p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n notifications; en boolean;
begin
  select * into n from notifications where id = p_id;
  if n.id is null or n.user_id is null then return; end if;
  en := person_lang(n.user_id) = 'en';
  perform net.http_post(
    url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('user_id', n.user_id, 'role', n.role, 'notification_id', n.id,
      'title', case when en then coalesce(n.title_en, n.title) else coalesce(n.title, n.title_en) end,
      'body',  case when en then coalesce(n.message_en, n.message) else coalesce(n.message, n.message_en) end));
exception when others then
  raise warning 'push_note: %', sqlerrm;
end $$;
revoke all on function public.push_note(uuid) from public, anon, authenticated;

create or replace function public.notify_person(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text,
  p_msg_hi text, p_msg_en text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare nid uuid;
begin
  if p_user is null then return; end if;
  insert into notifications (user_id, role, type, title, title_en, message, message_en, booking_id)
  values (p_user, p_role, p_type, p_title_hi, p_title_en, p_msg_hi, p_msg_en, p_booking) returning id into nid;
  perform push_note(nid);
exception when others then
  raise warning 'notify_person: %', sqlerrm;
end $$;

create or replace function public.notify_bi(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text,
  p_msg_hi text, p_msg_en text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare nid uuid;
begin
  insert into notifications (user_id, role, type, title, title_en, message, message_en, booking_id)
  values (p_user, p_role, p_type, p_title_hi, p_title_en, p_msg_hi, p_msg_en, p_booking) returning id into nid;
  perform push_note(nid);
end $$;

create or replace function public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare nid uuid;
begin
  insert into notifications (user_id, role, type, title, message, booking_id)
  values (p_user, p_role, p_type, p_title, p_msg, p_booking) returning id into nid;
  if p_role in ('vendor', 'customer') and p_user is not null then perform push_note(nid); end if;
end $$;

-- the phone reports back (service worker, no login)
create or replace function public.notification_track(p_id uuid, p_event text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_event = 'delivered' then
    update notifications set delivered_at = coalesce(delivered_at, now()) where id = p_id;
  elsif p_event = 'opened' then
    update notifications set opened_at = coalesce(opened_at, now()),
                             delivered_at = coalesce(delivered_at, now()), is_read = true,
                             read_at = coalesce(read_at, now()) where id = p_id;
  else
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.notification_track(uuid, text) from public;
grant execute on function public.notification_track(uuid, text) to anon, authenticated;

-- "seen in the app" also counts
create or replace function public.customer_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update notifications set is_read = true, read_at = coalesce(read_at, now())
   where user_id = auth.uid() and role = 'customer' and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.vendor_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update notifications set is_read = true, read_at = coalesce(read_at, now())
   where user_id = auth.uid() and role = 'vendor' and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.team_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update notifications set is_read = true, read_at = coalesce(read_at, now())
   where user_id = auth.uid() and role in ('staff', 'admin') and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.mark_notification_read(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update notifications set is_read = true, read_at = coalesce(read_at, now())
   where id = p_id and (user_id = auth.uid() or is_admin());
  return jsonb_build_object('ok', true);
end $$;

-- broadcasts: link every row to its broadcast
do $$ declare d text; begin
  d := pg_get_functiondef('public.admin_broadcast(text, text, text, text, text)'::regprocedure);
  if position('broadcast_id' in d) = 0 then
    d := replace(d, $x$  insert into broadcasts (audience, title, message, title_en, message_en, sent_to, devices, sent_by)
  values (p_audience, trim(p_title), trim(p_message), te, me, n, dev, auth.uid());$x$,
    $x$  insert into broadcasts (audience, title, message, title_en, message_en, sent_to, devices, sent_by)
  values (p_audience, trim(p_title), trim(p_message), te, me, n, dev, auth.uid()) returning id into bid;
  update notifications set broadcast_id = bid
   where type = 'broadcast' and broadcast_id is null and created_at >= now() and title = trim(p_title);$x$);
    d := replace(d, 'declare r record; n int := 0; dev int; te text; me text;', 'declare r record; n int := 0; dev int; te text; me text; bid uuid;');
    execute d;
  end if;
end $$;

-- who is this user (name + phone) for any role
create or replace function public.person_card(p_user uuid, p_role text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case p_role
    when 'customer' then (select jsonb_build_object('name', name, 'phone', phone) from customers where auth_user_id = p_user limit 1)
    when 'vendor'   then (select jsonb_build_object('name', name, 'phone', phone) from vendors   where auth_user_id = p_user limit 1)
    when 'staff'    then (select jsonb_build_object('name', name, 'phone', phone) from staff     where auth_user_id = p_user limit 1)
    when 'admin'    then (select jsonb_build_object('name', name, 'phone', null)  from admins    where auth_user_id = p_user limit 1)
  end;
$$;
revoke all on function public.person_card(uuid, text) from public, anon, authenticated;

-- admin report: every recipient with delivered / opened
create or replace function public.admin_notification_report(p_broadcast uuid default null, p_days int default 7, p_type text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]') into res from (
    select jsonb_build_object(
      'id', n.id, 'created_at', n.created_at, 'type', n.type, 'role', n.role,
      'title', coalesce(n.title_en, n.title), 'title_hi', n.title, 'broadcast_id', n.broadcast_id,
      'name', pc->>'name', 'phone', pc->>'phone',
      'devices', n.push_devices, 'sent', n.push_sent, 'failed', n.push_failed, 'push_at', n.push_at,
      'delivered_at', n.delivered_at, 'opened_at', n.opened_at, 'read_at', n.read_at,
      'tracked', n.push_at is not null or n.delivered_at is not null or n.read_at is not null) x
    from notifications n
    cross join lateral (select person_card(n.user_id, n.role) pc) p
    where (p_broadcast is null or n.broadcast_id = p_broadcast)
      and (p_broadcast is not null or n.created_at >= now() - make_interval(days => greatest(1, least(p_days, 90))))
      and (p_type is null or n.type = p_type)
    order by n.created_at desc limit 2000) s;
  return jsonb_build_object('ok', true, 'data', res);
end $$;
revoke all on function public.admin_notification_report(uuid, int, text) from public, anon;
grant execute on function public.admin_notification_report(uuid, int, text) to authenticated;

-- broadcast history with delivered / opened counts
create or replace function public.admin_broadcasts()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'history', coalesce((select jsonb_agg((to_jsonb(b) - 'sent_by') || jsonb_build_object(
        'delivered', (select count(*) from notifications n where n.broadcast_id = b.id and n.delivered_at is not null),
        'opened',    (select count(*) from notifications n where n.broadcast_id = b.id and (n.opened_at is not null or n.read_at is not null)),
        'pushed',    (select count(*) from notifications n where n.broadcast_id = b.id and n.push_sent > 0),
        'tracked',   exists (select 1 from notifications n where n.broadcast_id = b.id))
      order by b.created_at desc) from (select * from broadcasts order by created_at desc limit 50) b), '[]'::jsonb),
    'reach', jsonb_build_object(
      'customers', (select count(*) from customers where auth_user_id is not null and not coalesce(is_blocked, false)),
      'vendors', (select count(*) from vendors where auth_user_id is not null and status = 'approved'),
      'staff', (select count(*) from staff where auth_user_id is not null and is_active),
      'customer_devices', (select count(*) from push_subscriptions where is_active and role = 'customer'),
      'vendor_devices', (select count(*) from push_subscriptions where is_active and role = 'vendor'),
      'staff_devices', (select count(*) from push_subscriptions where is_active and role = 'staff'))));
end $$;
