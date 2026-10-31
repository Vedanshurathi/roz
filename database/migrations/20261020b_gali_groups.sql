-- 20 Oct 2026 — "Gali group order": neighbours who book the SAME vendor in the SAME slot on the same day.
-- When enough houses close together have booked (admin setting, default 3 houses within 150 m), everyone in the
-- group gets a bonus the vendor brings along (admin text, default "free coriander & green chillies"). Nothing about
-- money changes in the app — the bonus is given at the door. The vendor gets fewer, closer stops.
-- Neighbour = address within the radius by GPS pin; an address without a pin counts when it is in the same village
-- with the same street text. Only counts are shown to customers, never names or addresses.

alter table public.bookings add column if not exists gali_notified_at timestamptz;

-- settings with defaults (admin → Settings → Gali group)
create or replace function public.gali_cfg()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object('on', true, 'min', 3, 'radius_m', 150,
           'bonus_hi', 'मुफ़्त धनिया-मिर्च', 'bonus_en', 'Free coriander & green chillies')
      || coalesce((select value from app_settings where key = 'gali' and jsonb_typeof(value) = 'object'), '{}'::jsonb);
$function$;
revoke execute on function public.gali_cfg() from public, anon, authenticated;

-- the houses (one booking per customer) in the gali group of a booking — its own customer included
create or replace function public.gali_members(p_booking uuid)
 returns table(booking_id uuid, customer_id uuid)
 language sql stable security definer set search_path to 'public'
as $function$
  with me as (
    select b.id, b.vendor_id, b.booking_date, b.slot, a.lat, a.lng, a.area,
           lower(btrim(coalesce(a.street, ''))) st
      from bookings b join addresses a on a.id = b.address_id
     where b.id = p_booking and b.status not in ('cancelled', 'missed')),
  cfg as (select ((gali_cfg() ->> 'radius_m')::numeric / 1000)::double precision km)
  select distinct on (b.customer_id) b.id, b.customer_id
    from me, cfg, bookings b join addresses a on a.id = b.address_id
   where b.vendor_id = me.vendor_id and b.booking_date = me.booking_date and b.slot = me.slot
     and b.status not in ('cancelled', 'missed')
     and (b.id = me.id
          or (me.lat is not null and a.lat is not null and km_between(me.lat, me.lng, a.lat, a.lng) <= cfg.km)
          or ((me.lat is null or a.lat is null) and a.area = me.area and me.st <> ''
              and lower(btrim(coalesce(a.street, ''))) = me.st))
   order by b.customer_id, (b.id = me.id) desc, b.created_at;
$function$;
revoke execute on function public.gali_members(uuid) from public, anon, authenticated;

-- customer: my upcoming orders and how many houses are in each one's gali group
create or replace function public.customer_gali_status()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); cfg jsonb := gali_cfg(); mn int; items jsonb := '[]'::jsonb; r record; n int;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo', 'Please log in first')); end if;
  if not coalesce((cfg ->> 'on')::boolean, false) then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', false, 'items', '[]'::jsonb));
  end if;
  mn := (cfg ->> 'min')::int;
  for r in select id, code, booking_date, slot from bookings
            where customer_id = cid and booking_date between ist_date() and ist_date() + 14
              and status in ('placed', 'on_the_way', 'reached', 'bill_final', 'bill_approved')
            order by booking_date, slot loop
    select count(*) into n from gali_members(r.id);
    items := items || jsonb_build_object('booking_id', r.id, 'code', r.code, 'date', r.booking_date, 'slot', r.slot,
      'houses', n, 'complete', n >= mn);
  end loop;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', true, 'min', mn,
    'bonus_hi', cfg ->> 'bonus_hi', 'bonus_en', cfg ->> 'bonus_en', 'items', items));
end $function$;
revoke execute on function public.customer_gali_status() from public, anon;
grant execute on function public.customer_gali_status() to authenticated;

-- customer, before booking: how many neighbours already booked each slot (with this vendor, if one is chosen)
create or replace function public.customer_gali_slots(p_date date, p_vendor uuid default null, p_address uuid default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); cfg jsonb := gali_cfg(); a addresses; km double precision; res jsonb := '{}'::jsonb; s text; n int;
begin
  if cid is null or not coalesce((cfg ->> 'on')::boolean, false) then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', false, 'slots', '{}'::jsonb));
  end if;
  if p_date is null or p_date < ist_date() or p_date > ist_date() + 14 then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', true, 'slots', '{}'::jsonb));
  end if;
  select * into a from addresses
   where customer_id = cid and not coalesce(hidden, false) and (id = p_address or (p_address is null and is_default))
   order by (id = p_address) desc nulls last, created_at desc limit 1;
  if a.id is null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', true, 'slots', '{}'::jsonb));
  end if;
  km := (cfg ->> 'radius_m')::numeric / 1000;
  foreach s in array array['morning', 'afternoon', 'evening'] loop
    select count(distinct b.customer_id) into n
      from bookings b join addresses x on x.id = b.address_id
     where b.booking_date = p_date and b.slot::text = s and b.customer_id <> cid
       and b.status not in ('cancelled', 'missed')
       and (p_vendor is null or b.vendor_id = p_vendor)
       and ((a.lat is not null and x.lat is not null and km_between(a.lat, a.lng, x.lat, x.lng) <= km)
            or ((a.lat is null or x.lat is null) and x.area = a.area and coalesce(btrim(a.street), '') <> ''
                and lower(btrim(coalesce(x.street, ''))) = lower(btrim(a.street))));
    res := res || jsonb_build_object(s, n);
  end loop;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', true, 'min', (cfg ->> 'min')::int,
    'bonus_hi', cfg ->> 'bonus_hi', 'bonus_en', cfg ->> 'bonus_en', 'slots', res));
end $function$;
revoke execute on function public.customer_gali_slots(date, uuid, uuid) from public, anon;
grant execute on function public.customer_gali_slots(date, uuid, uuid) to authenticated;

-- vendor: which of the day's orders are in a gali group (to bring the bonus along)
create or replace function public.vendor_gali_groups(p_date date default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare vid uuid := my_vendor_id(); cfg jsonb := gali_cfg(); mn int; grp jsonb := '{}'::jsonb; r record; n int;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila', 'Vendor not found')); end if;
  if not coalesce((cfg ->> 'on')::boolean, false) then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', false, 'groups', '{}'::jsonb));
  end if;
  mn := (cfg ->> 'min')::int;
  for r in select id from bookings
            where vendor_id = vid and booking_date = coalesce(p_date, ist_date()) and status not in ('cancelled', 'missed') loop
    select count(*) into n from gali_members(r.id);
    if n >= 2 then grp := grp || jsonb_build_object(r.id::text, jsonb_build_object('houses', n, 'complete', n >= mn)); end if;
  end loop;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('on', true, 'min', mn,
    'bonus_hi', cfg ->> 'bonus_hi', 'bonus_en', cfg ->> 'bonus_en', 'groups', grp));
end $function$;
revoke execute on function public.vendor_gali_groups(date) from public, anon;
grant execute on function public.vendor_gali_groups(date) to authenticated;

-- a new booking may complete a group → tell every house in it (once) and the vendor
create or replace function public.tg_gali_check()
 returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare cfg jsonb := gali_cfg(); mn int; n int; r record; cu uuid; vu uuid; vn text; newly int := 0; slh text; sle text;
begin
  if not coalesce((cfg ->> 'on')::boolean, false) or new.status in ('cancelled', 'missed') or new.schedule_id is not null then
    return new;
  end if;
  mn := (cfg ->> 'min')::int;
  select count(*) into n from gali_members(new.id);
  if n < mn then return new; end if;
  for r in select m.booking_id, m.customer_id from gali_members(new.id) m join bookings b on b.id = m.booking_id
            where b.gali_notified_at is null loop
    update bookings set gali_notified_at = now() where id = r.booking_id;
    select auth_user_id into cu from customers where id = r.customer_id;
    perform notify_person(cu, 'customer', 'gali_complete',
      '🏘️ गली ग्रुप पूरा हो गया!', '🏘️ Your gali group is complete!',
      n || ' घर एक ही स्लॉट में — आपको मिलेगा: ' || (cfg ->> 'bonus_hi') || '। सब्ज़ीवाला ऑर्डर के साथ लाएगा।',
      n || ' houses in the same slot — you get: ' || (cfg ->> 'bonus_en') || '. The vendor brings it with your order.',
      r.booking_id);
    newly := newly + 1;
  end loop;
  if newly > 0 then
    select auth_user_id into vu from vendors where id = new.vendor_id;
    slh := case new.slot::text when 'morning' then 'सुबह' when 'afternoon' then 'दोपहर' else 'शाम' end;
    sle := case new.slot::text when 'morning' then 'morning' when 'afternoon' then 'afternoon' else 'evening' end;
    perform notify_person(vu, 'vendor', 'gali_complete',
      '🏘️ गली ग्रुप: ' || n || ' घर पास-पास', '🏘️ Gali group: ' || n || ' houses close together',
      to_char(new.booking_date, 'DD/MM') || ' ' || slh || ' — ' || n || ' घर एक ही गली में। हर घर को दें: ' || (cfg ->> 'bonus_hi'),
      to_char(new.booking_date, 'DD/MM') || ' ' || sle || ' — ' || n || ' houses in one lane. Give each: ' || (cfg ->> 'bonus_en'),
      new.id);
  end if;
  return new;
exception when others then
  raise warning 'tg_gali_check: %', sqlerrm;
  return new;          -- never block a booking
end $function$;
revoke execute on function public.tg_gali_check() from public, anon, authenticated;
create or replace trigger trg_gali_check after insert on public.bookings
  for each row execute function public.tg_gali_check();

-- admin: change the rule
create or replace function public.admin_set_gali(p_on boolean, p_min int, p_radius int, p_bonus_hi text, p_bonus_en text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v jsonb; old jsonb := gali_cfg();
begin
  perform admin_guard();
  if p_min is null or p_min < 2 or p_min > 10 then return jsonb_build_object('ok', false, 'msg', 'Ghar 2 se 10 ke beech rakho'); end if;
  if p_radius is null or p_radius < 50 or p_radius > 1000 then return jsonb_build_object('ok', false, 'msg', 'Doori 50 se 1000 meter ke beech rakho'); end if;
  if length(btrim(coalesce(p_bonus_hi, ''))) < 2 or length(p_bonus_hi) > 60 or length(btrim(coalesce(p_bonus_en, ''))) < 2 or length(p_bonus_en) > 60 then
    return jsonb_build_object('ok', false, 'msg', 'Inaam ka text Hindi aur English dono me likho (60 akshar tak)');
  end if;
  v := jsonb_build_object('on', coalesce(p_on, false), 'min', p_min, 'radius_m', p_radius,
         'bonus_hi', btrim(p_bonus_hi), 'bonus_en', btrim(p_bonus_en));
  insert into app_settings (key, value, updated_at, updated_by) values ('gali', v, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform log_action('gali_changed', 'settings', null, jsonb_build_object('from', old, 'to', v));
  return jsonb_build_object('ok', true, 'msg', case when coalesce(p_on, false) then 'Gali group chalu — ' || p_min || ' ghar, ' || p_radius || ' m' else 'Gali group band' end);
end $function$;
revoke execute on function public.admin_set_gali(boolean, int, int, text, text) from public, anon;
grant execute on function public.admin_set_gali(boolean, int, int, text, text) to authenticated;

-- admin settings + the public config now carry the gali rule
create or replace function public.admin_settings()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'commission_rate', commission_rate(),
    'commission_updated_at', (select updated_at from app_settings where key = 'commission_rate'),
    'customer_otp', customer_otp_on(),
    'min_order', min_order(),
    'min_order_updated_at', (select updated_at from app_settings where key = 'min_order'),
    'gali', gali_cfg(),
    'gali_updated_at', (select updated_at from app_settings where key = 'gali'),
    'gali_orders', (select count(*) from bookings where gali_notified_at is not null and booking_date >= ist_date()),
    'gali_orders_all', (select count(*) from bookings where gali_notified_at is not null)));
end $function$;

create or replace function public.public_app_config()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('min_order', min_order(), 'otp', customer_otp_on(),
    'gali', (select jsonb_build_object('on', c -> 'on', 'min', c -> 'min', 'bonus_hi', c -> 'bonus_hi', 'bonus_en', c -> 'bonus_en') from gali_cfg() c)));
$function$;
