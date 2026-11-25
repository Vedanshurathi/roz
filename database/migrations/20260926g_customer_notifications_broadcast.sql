-- Customer notifications that reach the phone, in the customer's own language
-- (English, or proper Devanagari Hindi), plus admin broadcasts to everyone.
--
--  * notify_person(): in-app row (title/message = Hindi, *_en = English) + one push in the
--    person's language (customers.lang / vendors.lang, default Hindi).
--  * order placed → "order confirmed"; status changes (vendor on the way, reached, paid,
--    order complete, missed, under review) → customer. bill_final and cancelled are already
--    sent by vendor_finalize_bill / *_cancel_booking, so the trigger skips them.
--  * reminders: 30 min before each slot (06:30 / 11:30 / 16:30 IST) and at 20:30 IST for
--    tomorrow's orders.
--  * notify_user() now also pushes for customers (was vendors only).
--  * admin_broadcast(audience, title, message[, title_en, message_en]) → all / customers /
--    vendors / staff; history in public.broadcasts (admin_broadcasts()).

create or replace function public.person_lang(p_user uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select lang from customers where auth_user_id = p_user limit 1),
                  (select lang from vendors where auth_user_id = p_user limit 1), 'hi');
$$;

create or replace function public.push_to(p_user uuid, p_role text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_user is null then return; end if;
  perform net.http_post(
    url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('user_id', p_user, 'role', p_role, 'title', p_title, 'body', p_body));
exception when others then
  raise warning 'push_to: %', sqlerrm;
end $$;

create or replace function public.notify_person(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text,
                                               p_msg_hi text, p_msg_en text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null then return; end if;
  insert into notifications (user_id, role, type, title, title_en, message, message_en, booking_id)
  values (p_user, p_role, p_type, p_title_hi, p_title_en, p_msg_hi, p_msg_en, p_booking);
  if person_lang(p_user) = 'en' then perform push_to(p_user, p_role, p_title_en, p_msg_en);
  else perform push_to(p_user, p_role, p_title_hi, p_msg_hi); end if;
exception when others then
  raise warning 'notify_person: %', sqlerrm;
end $$;

-- notify_user(): push for vendors (20260926e) and now customers too
create or replace function public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  insert into notifications (user_id, role, type, title, message, booking_id)
  values (p_user, p_role, p_type, p_title, p_msg, p_booking);
  if p_role in ('vendor', 'customer') and p_user is not null then
    perform push_to(p_user, p_role, p_title, p_msg);
  end if;
end $$;

create or replace function public.slot_label(p_slot time_slot, p_lang text)
returns text language sql immutable as $$
  select case when p_lang = 'en' then
    case p_slot when 'morning' then 'morning (7–11 am)' when 'afternoon' then 'afternoon (12–4 pm)' else 'evening (5–8 pm)' end
  else
    case p_slot when 'morning' then 'सुबह (7–11 बजे)' when 'afternoon' then 'दोपहर (12–4 बजे)' else 'शाम (5–8 बजे)' end end;
$$;

-- order placed → customer "order confirmed"
create or replace function public.tg_customer_booking_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare cu uuid; vn text; d_en text; d_hi text;
begin
  select auth_user_id into cu from customers where id = new.customer_id;
  if cu is null then return new; end if;
  select coalesce(shop_name, name) into vn from vendors where id = new.vendor_id;
  d_en := case when new.booking_date = ist_date() then 'today' when new.booking_date = ist_date() + 1 then 'tomorrow' else to_char(new.booking_date, 'DD Mon') end;
  d_hi := case when new.booking_date = ist_date() then 'आज' when new.booking_date = ist_date() + 1 then 'कल' else to_char(new.booking_date, 'DD/MM') end;
  perform notify_person(cu, 'customer', 'booking_confirmed',
    '✅ ऑर्डर पक्का हो गया', '✅ Order confirmed',
    coalesce(vn, 'आपका सब्ज़ीवाला') || ' ' || d_hi || ' ' || slot_label(new.slot, 'hi') || ' में आएगा। ऑर्डर ' || new.code,
    coalesce(vn, 'Your vendor') || ' will come ' || d_en || ', ' || slot_label(new.slot, 'en') || '. Order ' || new.code,
    new.id);
  return new;
exception when others then
  raise warning 'tg_customer_booking_created: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_customer_booking_created on public.bookings;
create trigger trg_customer_booking_created after insert on public.bookings
  for each row execute function public.tg_customer_booking_created();

-- status change → customer (bilingual + push). bill_final / cancelled are sent elsewhere.
create or replace function public.tg_status_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare cu uuid; vn text; th text; te text; mh text; me text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select auth_user_id into cu from customers where id = new.customer_id;
  if cu is null then return new; end if;
  select coalesce(shop_name, name) into vn from vendors where id = new.vendor_id;
  vn := coalesce(vn, 'Vendor');
  case new.status
    when 'on_the_way' then th := '🚚 सब्ज़ीवाला निकल चुका है'; te := '🚚 Your vendor is on the way';
      mh := vn || ' आपके घर आ रहे हैं। ऑर्डर ' || new.code; me := vn || ' is on the way to you. Order ' || new.code;
    when 'reached' then th := '📍 सब्ज़ीवाला आपके घर पहुँच गया'; te := '📍 Your vendor has arrived';
      mh := vn || ' बाहर हैं — सामान तौल कर बिल बनाएँगे।'; me := vn || ' is at your door and will weigh your items now.';
    when 'paid' then th := '💵 पेमेंट मिल गया'; te := '💵 Payment received';
      mh := 'अब सब्ज़ीवाले को अपना 4 अंकों का डिलीवरी कोड बताएँ।'; me := 'Now tell the vendor your 4-digit delivery code.';
    when 'delivered' then th := '🎉 ऑर्डर पूरा हुआ'; te := '🎉 Order complete';
      mh := 'धन्यवाद! ' || vn || ' को रेटिंग दें — इससे दूसरों को मदद मिलती है।'; me := 'Thank you! Please rate ' || vn || ' — it helps others.';
    when 'missed' then th := '😔 सब्ज़ीवाला नहीं पहुँच पाया'; te := '😔 Your vendor could not come';
      mh := 'माफ़ कीजिए। हम देख रहे हैं — ऐप से दोबारा ऑर्डर कर सकते हैं।'; me := 'Sorry about this. We are looking into it — you can book again in the app.';
    when 'pending_review' then th := '🔍 ऑर्डर जाँच में है'; te := '🔍 Order under review';
      mh := 'RozBazaar टीम जल्दी आपसे संपर्क करेगी।'; me := 'The RozBazaar team will contact you soon.';
    else return new;
  end case;
  perform notify_person(cu, 'customer', 'booking_' || new.status, th, te, mh, me, new.id);
  return new;
exception when others then
  raise warning 'tg_status_notify: %', sqlerrm; return new;
end $$;

-- reminders
create or replace function public.job_customer_slot_reminder(p_slot time_slot)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0;
begin
  for r in
    select b.id, b.code, c.auth_user_id, coalesce(v.shop_name, v.name, 'Vendor') vn
      from bookings b join customers c on c.id = b.customer_id left join vendors v on v.id = b.vendor_id
     where b.booking_date = ist_date() and b.slot = p_slot and b.status in ('placed', 'on_the_way') and c.auth_user_id is not null
  loop
    perform notify_person(r.auth_user_id, 'customer', 'slot_reminder',
      '⏰ आपका ऑर्डर आज ' || slot_label(p_slot, 'hi') || ' में आएगा', '⏰ Your order comes this ' || slot_label(p_slot, 'en'),
      r.vn || ' जल्द आपके घर आएँगे। घर पर रहें और डिलीवरी कोड तैयार रखें।', r.vn || ' will be at your door soon. Please be home and keep your delivery code ready.',
      r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', n);
end $$;

create or replace function public.job_customer_tomorrow_reminder()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0;
begin
  for r in
    select b.id, b.slot, c.auth_user_id, coalesce(v.shop_name, v.name, 'Vendor') vn
      from bookings b join customers c on c.id = b.customer_id left join vendors v on v.id = b.vendor_id
     where b.booking_date = ist_date() + 1 and b.status = 'placed' and c.auth_user_id is not null
  loop
    perform notify_person(r.auth_user_id, 'customer', 'tomorrow_reminder',
      '🗓️ कल आपका ऑर्डर आएगा', '🗓️ Your order comes tomorrow',
      r.vn || ' कल ' || slot_label(r.slot, 'hi') || ' में आएँगे।', r.vn || ' will come tomorrow, ' || slot_label(r.slot, 'en') || '.',
      r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', n);
end $$;

do $$
declare j text;
begin
  foreach j in array array['rz-customer-slot-morning','rz-customer-slot-afternoon','rz-customer-slot-evening','rz-customer-tomorrow'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
end $$;
select cron.schedule('rz-customer-slot-morning',   '0 1 * * *',  $$select public.job_customer_slot_reminder('morning')$$);    -- 06:30 IST
select cron.schedule('rz-customer-slot-afternoon', '0 6 * * *',  $$select public.job_customer_slot_reminder('afternoon')$$);  -- 11:30 IST
select cron.schedule('rz-customer-slot-evening',   '0 11 * * *', $$select public.job_customer_slot_reminder('evening')$$);    -- 16:30 IST
select cron.schedule('rz-customer-tomorrow',       '0 15 * * *', $$select public.job_customer_tomorrow_reminder()$$);         -- 20:30 IST

-- admin broadcast
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('all', 'customers', 'vendors', 'staff')),
  title text not null, message text not null, title_en text, message_en text,
  sent_to int not null default 0, devices int not null default 0,
  sent_by uuid, created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
revoke all on public.broadcasts from anon, authenticated;

create or replace function public.admin_broadcast(p_audience text, p_title text, p_message text,
                                                 p_title_en text default null, p_message_en text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0; dev int; te text; me text;
begin
  perform admin_guard();
  if p_audience not in ('all', 'customers', 'vendors', 'staff') then return jsonb_build_object('ok', false, 'msg', 'Kisko bhejna hai chuno'); end if;
  if length(trim(coalesce(p_title, ''))) < 2 or length(trim(coalesce(p_message, ''))) < 2 then
    return jsonb_build_object('ok', false, 'msg', 'Title aur message dono likho');
  end if;
  te := coalesce(nullif(trim(p_title_en), ''), trim(p_title));
  me := coalesce(nullif(trim(p_message_en), ''), trim(p_message));
  for r in
    select distinct on (uid) uid, role from (
      select auth_user_id uid, 'customer' role from customers where auth_user_id is not null and not coalesce(is_blocked, false) and p_audience in ('all', 'customers')
      union all
      select auth_user_id, 'vendor' from vendors where auth_user_id is not null and status = 'approved' and p_audience in ('all', 'vendors')
      union all
      select auth_user_id, 'staff' from staff where auth_user_id is not null and is_active and p_audience in ('all', 'staff')
    ) t where uid is not null
  loop
    perform notify_person(r.uid, r.role, 'broadcast', trim(p_title), te, trim(p_message), me, null);
    n := n + 1;
  end loop;
  select count(*) into dev from push_subscriptions ps where ps.is_active and (
       (p_audience in ('all', 'customers') and ps.role = 'customer')
    or (p_audience in ('all', 'vendors') and ps.role = 'vendor')
    or (p_audience in ('all', 'staff') and ps.role = 'staff'));
  insert into broadcasts (audience, title, message, title_en, message_en, sent_to, devices, sent_by)
  values (p_audience, trim(p_title), trim(p_message), te, me, n, dev, auth.uid());
  perform log_action('broadcast', 'broadcast', null, jsonb_build_object('audience', p_audience, 'sent_to', n));
  return jsonb_build_object('ok', true, 'msg', n || ' logon ko bhej diya (' || dev || ' phone pe notification chalu)',
    'data', jsonb_build_object('sent_to', n, 'devices', dev));
end $$;

create or replace function public.admin_broadcasts()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'history', coalesce((select jsonb_agg(to_jsonb(b) - 'sent_by' order by b.created_at desc) from (select * from broadcasts order by created_at desc limit 50) b), '[]'::jsonb),
    'reach', jsonb_build_object(
      'customers', (select count(*) from customers where auth_user_id is not null and not coalesce(is_blocked, false)),
      'vendors', (select count(*) from vendors where auth_user_id is not null and status = 'approved'),
      'staff', (select count(*) from staff where auth_user_id is not null and is_active),
      'customer_devices', (select count(*) from push_subscriptions where is_active and role = 'customer'),
      'vendor_devices', (select count(*) from push_subscriptions where is_active and role = 'vendor'),
      'staff_devices', (select count(*) from push_subscriptions where is_active and role = 'staff'))));
end $$;

-- customer app: inbox (bilingual) + mark read
create or replace function public.customer_notifications(p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare l text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Login'); end if;
  l := person_lang(auth.uid());
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'booking_id', n.booking_id, 'is_read', n.is_read, 'created_at', n.created_at,
      'title', n.title, 'title_en', coalesce(n.title_en, n.title), 'message', n.message, 'message_en', coalesce(n.message_en, n.message))
      order by n.created_at desc)
    from (select * from notifications where user_id = auth.uid() and role = 'customer'
          order by created_at desc limit least(greatest(p_limit, 1), 100)) n), '[]'::jsonb));
end $$;

create or replace function public.customer_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update notifications set is_read = true where user_id = auth.uid() and role = 'customer' and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.person_lang(uuid)                                   from public, anon, authenticated;
revoke all on function public.push_to(uuid, text, text, text)                     from public, anon, authenticated;
revoke all on function public.notify_person(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.tg_customer_booking_created()                       from public, anon, authenticated;
revoke all on function public.job_customer_slot_reminder(time_slot)               from public, anon, authenticated;
revoke all on function public.job_customer_tomorrow_reminder()                    from public, anon, authenticated;
revoke all on function public.admin_broadcast(text, text, text, text, text)       from public, anon;
revoke all on function public.admin_broadcasts()                                  from public, anon;
revoke all on function public.customer_notifications(int)                         from public, anon;
revoke all on function public.customer_mark_read(uuid)                            from public, anon;
grant execute on function public.admin_broadcast(text, text, text, text, text), public.admin_broadcasts(),
  public.customer_notifications(int), public.customer_mark_read(uuid) to authenticated;
