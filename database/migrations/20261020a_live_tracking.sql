-- 20 Oct 2026 — live vendor tracking ("Live sabzi wala").
-- While a vendor has an order "on the way", the vendor app sends the phone's GPS position every ~15 s
-- (vendor_share_location). The customer of THAT order sees it on a map with distance + ETA (customer_track).
-- Nobody else can read it: the table has no grants; both functions check whose order it is.
-- Once per order, when the vendor is within ~700 m of the house, the customer gets "almost there".

create table if not exists public.vendor_live_location(
  vendor_id  uuid primary key references public.vendors(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  acc        real,
  heading    real,
  speed      real,
  updated_at timestamptz not null default now()
);
alter table public.vendor_live_location enable row level security;
revoke all on public.vendor_live_location from public, anon, authenticated;

alter table public.bookings add column if not exists near_notified_at timestamptz;

-- km/h for the ETA, from what the vendor wrote as vehicle (null for everyone today → 12)
create or replace function public.vendor_speed_kmh(p_vehicle text)
 returns numeric language sql immutable set search_path to 'pg_catalog'
as $function$
  select (case
    when p_vehicle is null or btrim(p_vehicle) = '' then 12
    when lower(p_vehicle) ~ '(thela|thelā|cart|haath|hath|walk|ठेला|पैदल)' then 5
    when lower(p_vehicle) ~ '(motor|bike|scooty|scooter|activa|splendor|बाइक|स्कूटी)' then 20
    when lower(p_vehicle) ~ '(cycle|साइकिल)' then 10
    when lower(p_vehicle) ~ '(rickshaw|e-rick|erick|tempo|auto|रिक्शा|टेम्पो)' then 15
    else 12 end)::numeric
$function$;
revoke execute on function public.vendor_speed_kmh(text) from public, anon, authenticated;

-- vendor app → current position (only while an order of this vendor is on the way)
create or replace function public.vendor_share_location(p_lat double precision, p_lng double precision,
  p_acc double precision default null, p_heading double precision default null, p_speed double precision default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare vid uuid := my_vendor_id(); n int; last_at timestamptz; vn text; r record; cu uuid; d double precision;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila', 'Vendor not found')); end if;
  if p_lat is null or p_lng is null or p_lat not between 6 and 38 or p_lng not between 68 and 98 then
    return jsonb_build_object('ok', false, 'msg', 'bad location');
  end if;
  select count(*) into n from bookings
   where vendor_id = vid and status = 'on_the_way' and booking_date between ist_date() - 1 and ist_date();
  if n = 0 then return jsonb_build_object('ok', true, 'data', jsonb_build_object('sharing', false)); end if;

  select updated_at into last_at from vendor_live_location where vendor_id = vid;
  if last_at is not null and last_at > now() - interval '4 seconds' then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('sharing', true, 'orders', n, 'skipped', true));
  end if;
  insert into vendor_live_location(vendor_id, lat, lng, acc, heading, speed, updated_at)
  values (vid, p_lat, p_lng, least(greatest(p_acc, 0), 100000), p_heading, p_speed, now())
  on conflict (vendor_id) do update
    set lat = excluded.lat, lng = excluded.lng, acc = excluded.acc, heading = excluded.heading,
        speed = excluded.speed, updated_at = now();

  -- "almost there" — once per order, only on a good fix
  if coalesce(p_acc, 0) <= 300 then
    for r in select b.id, b.code, b.customer_id, a.lat, a.lng
               from bookings b join addresses a on a.id = b.address_id
              where b.vendor_id = vid and b.status = 'on_the_way' and b.near_notified_at is null
                and a.lat is not null and a.lng is not null
                and b.booking_date between ist_date() - 1 and ist_date() loop
      d := km_between(p_lat, p_lng, r.lat, r.lng);
      if d <= 0.7 then
        update bookings set near_notified_at = now() where id = r.id;
        select auth_user_id into cu from customers where id = r.customer_id;
        select coalesce(shop_name, name) into vn from vendors where id = vid;
        if cu is not null then
          perform notify_person(cu, 'customer', 'booking_near',
            '🛵 सब्ज़ीवाला बस पहुँचने वाला है', '🛵 Your vendor is almost there',
            coalesce(vn, 'सब्ज़ीवाला') || ' कुछ ही मिनट में आपके घर होंगे। ऑर्डर ' || r.code,
            coalesce(vn, 'Your vendor') || ' will be at your door in a few minutes. Order ' || r.code, r.id);
        end if;
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('sharing', true, 'orders', n));
end $function$;
revoke execute on function public.vendor_share_location(double precision, double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.vendor_share_location(double precision, double precision, double precision, double precision, double precision) to authenticated;

-- customer app → where is my vendor (only for the customer's own order, only while it is on the way)
create or replace function public.customer_track(p_booking uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); bk bookings; v vendors; loc vendor_live_location; a addresses; ar areas;
  dlat double precision; dlng double precision; approx boolean := false; d double precision; eta int; spd numeric; age int;
  dest jsonb;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo', 'Please log in first')); end if;
  select * into bk from bookings where id = p_booking and customer_id = cid;
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila', 'Order not found')); end if;
  select * into v from vendors where id = bk.vendor_id;
  select * into a from addresses where id = bk.address_id;
  dlat := a.lat; dlng := a.lng;
  if dlat is null and a.id is not null then
    select * into ar from areas where name = a.area;
    dlat := ar.lat; dlng := ar.lng; approx := true;
  end if;
  dest := case when dlat is null then null else jsonb_build_object('lat', dlat, 'lng', dlng, 'approx', approx) end;
  if bk.status <> 'on_the_way' then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('status', bk.status, 'code', bk.code, 'live', false,
      'dest', dest, 'vendor_name', coalesce(v.shop_name, v.name), 'vendor_photo', v.photo_url));
  end if;
  select * into loc from vendor_live_location
   where vendor_id = bk.vendor_id and updated_at > now() - interval '5 minutes';
  spd := vendor_speed_kmh(v.vehicle);
  if loc.vendor_id is not null then
    age := extract(epoch from now() - loc.updated_at)::int;
    if dlat is not null then
      d := km_between(loc.lat, loc.lng, dlat, dlng);
      eta := greatest(1, ceil(d * 1.3 / spd * 60))::int;     -- roads are ~30% longer than a straight line
    end if;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'status', bk.status, 'code', bk.code, 'live', loc.vendor_id is not null,
    'vendor', case when loc.vendor_id is null then null
                   else jsonb_build_object('lat', loc.lat, 'lng', loc.lng, 'acc', loc.acc, 'heading', loc.heading, 'age_s', age) end,
    'dest', dest,
    'dist_km', case when d is null then null else round(d::numeric, 2) end,
    'eta_min', eta, 'speed_kmh', spd,
    'vendor_name', coalesce(v.shop_name, v.name), 'vendor_photo', v.photo_url));
end $function$;
revoke execute on function public.customer_track(uuid) from public, anon;
grant execute on function public.customer_track(uuid) to authenticated;

