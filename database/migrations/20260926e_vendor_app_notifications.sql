-- Vendor app (its own Hostinger site): richer notifications + phone/password login.
--  * notify_user() now also sends a phone push when the recipient is a vendor, so the
--    existing vendor alerts (bill approved, customer cancelled, reassigned, price
--    reminder) reach the phone, not only the in-app list.
--  * New vendor alerts: bill disputed, order missed (status triggers), new rating,
--    item approved/rejected, slot starting in 30 min, slot started, evening summary.
--  * Vendors can log in with phone + password (set by an admin) as well as Google:
--    auth user <phone>@vendor.rozbazaar.shop, linked through vendors.auth_user_id.

-- ---------- push for vendor notify_user() ----------
create or replace function public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  insert into notifications (user_id, role, type, title, message, booking_id)
  values (p_user, p_role, p_type, p_title, p_msg, p_booking);
  if p_role = 'vendor' and p_user is not null then
    begin
      perform net.http_post(
        url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/send-push',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('user_id', p_user, 'role', p_role, 'title', p_title, 'body', p_msg));
    exception when others then
      raise warning 'vendor push failed: %', sqlerrm;   -- the in-app row is already saved
    end;
  end if;
end $$;

-- ---------- helper ----------
create or replace function public.vendor_notify(p_vendor uuid, p_type text, p_title text, p_msg text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid;
begin
  select auth_user_id into uid from vendors where id = p_vendor;
  if uid is null then return; end if;
  perform notify_user(uid, 'vendor', p_type, p_title, p_msg, p_booking);
exception when others then
  raise warning 'vendor_notify: %', sqlerrm;
end $$;

-- ---------- booking status → vendor ----------
create or replace function public.tg_vendor_booking_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.vendor_id is null or new.status is not distinct from old.status then return new; end if;
  if new.status = 'disputed' then
    perform vendor_notify(new.vendor_id, 'bill_disputed', '⚠️ ' || new.code || ': bill pe sawaal',
      'Customer ne bill approve nahi kiya' || coalesce(' — ' || new.dispute_reason, '') || '. Admin dekhega.', new.id);
  elsif new.status = 'missed' then
    perform vendor_notify(new.vendor_id, 'order_missed', '⌛ ' || new.code || ' miss ho gaya',
      'Slot khatam ho gaya aur order deliver nahi hua. Agli baar time pe pahuncho.', new.id);
  end if;
  return new;
exception when others then
  raise warning 'tg_vendor_booking_notify: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_vendor_booking_notify on public.bookings;
create trigger trg_vendor_booking_notify after update on public.bookings
  for each row execute function public.tg_vendor_booking_notify();

-- ---------- new rating → vendor ----------
create or replace function public.tg_vendor_rating_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare c text; code text;
begin
  select cu.name, b.code into c, code from bookings b join customers cu on cu.id = b.customer_id where b.id = new.booking_id;
  perform vendor_notify(new.vendor_id, 'new_rating',
    repeat('⭐', greatest(1, least(5, new.stars))) || ' naya rating',
    coalesce(c, 'Customer') || ' ne ' || new.stars || ' star diye' || coalesce(' — "' || left(new.comment, 80) || '"', ''), new.booking_id);
  return new;
exception when others then
  raise warning 'tg_vendor_rating_notify: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_vendor_rating_notify on public.ratings;
create trigger trg_vendor_rating_notify after insert on public.ratings
  for each row execute function public.tg_vendor_rating_notify();

-- ---------- product approved / rejected → vendor ----------
create or replace function public.tg_vendor_product_review_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.review_status is distinct from old.review_status and new.review_status in ('approved', 'rejected') then
    perform vendor_notify(new.vendor_id, 'product_review',
      case when new.review_status = 'approved' then '✅ ' || new.name || ' approve ho gaya' else '❌ ' || new.name || ' reject hua' end,
      case when new.review_status = 'approved' then 'Ab customers ko dikh raha hai.'
           else coalesce('Wajah: ' || new.review_note, 'Admin se baat karo.') end, null);
  end if;
  return new;
exception when others then
  raise warning 'tg_vendor_product_review_notify: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_vendor_product_review_notify on public.products;
create trigger trg_vendor_product_review_notify after update of review_status on public.products
  for each row execute function public.tg_vendor_product_review_notify();

-- ---------- slot reminders + evening summary (pg_cron, times in UTC) ----------
create or replace function public.job_vendor_slot_alert(p_slot time_slot, p_phase text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0; label text;
begin
  label := case p_slot when 'morning' then 'Subah (7–11)' when 'afternoon' then 'Dopahar (12–4)' else 'Shaam (5–8)' end;
  for r in
    select b.vendor_id, count(*) as cnt, string_agg(distinct b.area, ', ') as areas
      from booking_full b join vendors v on v.id = b.vendor_id
     where b.booking_date = ist_date() and b.slot = p_slot
       and b.status in ('placed', 'on_the_way') and v.is_active and v.auth_user_id is not null
     group by b.vendor_id
  loop
    if p_phase = 'soon' then
      perform vendor_notify(r.vendor_id, 'slot_soon', '⏰ ' || label || ' slot 30 min me',
        r.cnt || ' order taiyaar rakho — ' || coalesce(r.areas, ''), null);
    else
      perform vendor_notify(r.vendor_id, 'slot_start', '🚚 ' || label || ' slot shuru!',
        r.cnt || ' order baaki — app kholo aur "Nikal gaya" dabao. Gaon: ' || coalesce(r.areas, ''), null);
    end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'vendors', n);
end $$;

create or replace function public.job_vendor_daily_summary()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0;
begin
  for r in
    select v.id,
      (select count(*) from bookings b where b.vendor_id = v.id and b.booking_date = ist_date() and b.status in ('delivered', 'completed', 'paid')) as done,
      (select coalesce(sum(coalesce(p.amount, b.final_total)), 0) from bookings b left join payments p on p.booking_id = b.id
        where b.vendor_id = v.id and b.booking_date = ist_date() and b.status in ('delivered', 'completed', 'paid')) as earned,
      (select count(*) from bookings b where b.vendor_id = v.id and b.booking_date = ist_date() + 1 and b.status = 'placed') as tomorrow
      from vendors v where v.status = 'approved' and v.is_active and v.auth_user_id is not null
  loop
    continue when r.done = 0 and r.tomorrow = 0;
    perform vendor_notify(r.id, 'daily_summary', '🌙 Aaj ka hisaab',
      case when r.done > 0 then r.done || ' order · ₹' || to_char(r.earned, 'FM99,99,999') || ' kamaye. ' else '' end ||
      case when r.tomorrow > 0 then 'Kal ke ' || r.tomorrow || ' order book hain.' else 'Kal ke liye abhi order nahi.' end, null);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'vendors', n);
end $$;

do $$
declare j text;
begin
  foreach j in array array['rz-vendor-slot-soon-morning','rz-vendor-slot-start-morning','rz-vendor-slot-soon-afternoon',
                           'rz-vendor-slot-start-afternoon','rz-vendor-slot-soon-evening','rz-vendor-slot-start-evening','rz-vendor-daily-summary'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
end $$;
select cron.schedule('rz-vendor-slot-soon-morning',    '0 1 * * *',   $$select public.job_vendor_slot_alert('morning','soon')$$);     -- 06:30 IST
select cron.schedule('rz-vendor-slot-start-morning',   '30 1 * * *',  $$select public.job_vendor_slot_alert('morning','start')$$);    -- 07:00 IST
select cron.schedule('rz-vendor-slot-soon-afternoon',  '0 6 * * *',   $$select public.job_vendor_slot_alert('afternoon','soon')$$);   -- 11:30 IST
select cron.schedule('rz-vendor-slot-start-afternoon', '30 6 * * *',  $$select public.job_vendor_slot_alert('afternoon','start')$$);  -- 12:00 IST
select cron.schedule('rz-vendor-slot-soon-evening',    '0 11 * * *',  $$select public.job_vendor_slot_alert('evening','soon')$$);     -- 16:30 IST
select cron.schedule('rz-vendor-slot-start-evening',   '30 11 * * *', $$select public.job_vendor_slot_alert('evening','start')$$);    -- 17:00 IST
select cron.schedule('rz-vendor-daily-summary',        '15 15 * * *', $$select public.job_vendor_daily_summary()$$);                  -- 20:45 IST

-- ---------- vendor notification inbox helpers ----------
create or replace function public.vendor_notifications(p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Login karo'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'title', coalesce(n.title_en, n.title),
      'message', coalesce(n.message, n.message_en), 'booking_id', n.booking_id, 'is_read', n.is_read, 'created_at', n.created_at)
      order by n.created_at desc)
    from (select * from notifications where user_id = auth.uid() and role = 'vendor'
          order by created_at desc limit least(greatest(p_limit, 1), 100)) n), '[]'::jsonb));
end $$;

create or replace function public.vendor_mark_read(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update notifications set is_read = true
   where user_id = auth.uid() and role = 'vendor' and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.vendor_save_push(p_endpoint text, p_p256dh text, p_auth text, p_agent text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if my_vendor_id() is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if coalesce(p_endpoint, '') = '' then return jsonb_build_object('ok', false, 'msg', 'Galat request'); end if;
  insert into push_subscriptions (user_id, role, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), 'vendor', p_endpoint, p_p256dh, p_auth, left(p_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, role = 'vendor', p256dh = excluded.p256dh,
                                       auth_key = excluded.auth_key, is_active = true, last_seen = now();
  return jsonb_build_object('ok', true, 'msg', 'Notifications chalu ✓');
end $$;

-- ---------- phone + password login for vendors (set by admin) ----------
create or replace function public.vendor_login_email(p_phone text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10) || '@vendor.rozbazaar.shop';
$$;

create or replace function public.admin_set_vendor_login(p_vendor uuid, p_password text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v vendors; em text; uid uuid; cur_email text;
begin
  perform admin_guard();
  select * into v from vendors where id = p_vendor;
  if v.id is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password kam se kam 6 character'); end if;
  if length(right(regexp_replace(coalesce(v.phone, ''), '\D', '', 'g'), 10)) <> 10 then
    return jsonb_build_object('ok', false, 'msg', 'Vendor ka phone 10 digit ka nahi hai');
  end if;
  em := vendor_login_email(v.phone);

  if v.auth_user_id is not null then
    select email into cur_email from auth.users where id = v.auth_user_id;
    if cur_email is distinct from em then
      return jsonb_build_object('ok', false, 'msg', 'Ye vendor Google se login karta hai (' || coalesce(cur_email, '?') || ') — wahi use kare');
    end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = v.auth_user_id;
    return jsonb_build_object('ok', true, 'msg', 'Naya password set — phone ' || v.phone || ' se login karega');
  end if;

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

-- ---------- privileges ----------
revoke all on function public.vendor_notify(uuid, text, text, text, uuid)            from public, anon, authenticated;
revoke all on function public.tg_vendor_booking_notify()                             from public, anon, authenticated;
revoke all on function public.tg_vendor_rating_notify()                              from public, anon, authenticated;
revoke all on function public.tg_vendor_product_review_notify()                      from public, anon, authenticated;
revoke all on function public.job_vendor_slot_alert(time_slot, text)                 from public, anon, authenticated;
revoke all on function public.job_vendor_daily_summary()                             from public, anon, authenticated;
revoke all on function public.vendor_notifications(int)                              from public, anon;
revoke all on function public.vendor_mark_read(uuid)                                 from public, anon;
revoke all on function public.vendor_save_push(text, text, text, text)               from public, anon;
revoke all on function public.admin_set_vendor_login(uuid, text)                     from public, anon;
grant execute on function public.vendor_notifications(int), public.vendor_mark_read(uuid),
  public.vendor_save_push(text, text, text, text), public.admin_set_vendor_login(uuid, text) to authenticated;
