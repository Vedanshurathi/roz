-- 21 Oct 2026 — service area: RozBazaar delivers only within N km (admin setting, default 8) of a LIVE village
-- (areas.is_active with a map point — today Khandewla and Jatola). Vedanshu: "if anyone is more than 8 km away,
-- say thanks for using RozBazaar but it is not available in your area".
-- The customer site checks the phone's location and shows that message; the database also refuses to save an
-- address pin, or book to one, outside the area (code OUT_OF_AREA), so the rule can't be skipped. Addresses
-- without a pin are not affected (village + text). No existing data is changed.

create or replace function public.service_km()
 returns numeric language sql stable security definer set search_path to 'public'
as $function$
  select coalesce((select (value #>> '{}')::numeric from app_settings where key = 'service_km'), 8);
$function$;

-- is this point inside the service area? (anyone may ask — used before login too)
create or replace function public.service_area_check(p_lat double precision, p_lng double precision)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare nm text; km double precision; lim numeric := service_km(); vil jsonb;
begin
  select coalesce(jsonb_agg(name order by sort_order nulls last, name), '[]'::jsonb) into vil
    from areas where is_active and lat is not null and lng is not null;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('ok', false, 'msg', 'bad location');
  end if;
  select a.name, km_between(p_lat, p_lng, a.lat, a.lng) into nm, km
    from areas a where a.is_active and a.lat is not null and a.lng is not null
   order by km_between(p_lat, p_lng, a.lat, a.lng) limit 1;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'inside', nm is null or km <= lim,          -- no village with a map point yet → never block
    'km', case when km is null then null else round(km::numeric, 1) end,
    'nearest', nm, 'service_km', lim, 'villages', vil));
end $function$;
grant execute on function public.service_area_check(double precision, double precision) to anon, authenticated;

-- the message, in the person's language
create or replace function public.service_area_msg()
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select tr_dev(
    'RozBazaar इस्तेमाल करने के लिए धन्यवाद! अभी हम आपके इलाके में नहीं पहुँचते — हम ' || v || ' के ' || service_km() || ' किमी के अंदर ही सामान पहुँचाते हैं।',
    'Thank you for using RozBazaar! We don''t deliver to your area yet — we deliver within ' || service_km() || ' km of ' || v || '.')
  from (select coalesce(string_agg(name, ', ' order by sort_order nulls last, name), 'our villages') v
          from areas where is_active and lat is not null and lng is not null) s;
$function$;
revoke execute on function public.service_area_msg() from public, anon, authenticated;

-- save address: a pin outside the service area is refused (the customer gets the message, can move the pin)
create or replace function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text,
  p_lat double precision default null, p_lng double precision default null, p_make_default boolean default true,
  p_address_id uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cid uuid; a addresses; chk jsonb;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if coalesce(trim(p_area),'') = '' or not exists (select 1 from areas where name = p_area) then
    return jsonb_build_object('ok', false, 'msg', tr('Gaon chuno','Choose your village'));
  end if;
  if (p_lat is not null and (p_lat < -90 or p_lat > 90)) or (p_lng is not null and (p_lng < -180 or p_lng > 180))
     or (p_lat is null) <> (p_lng is null) then
    p_lat := null; p_lng := null;
  end if;
  if p_lat is not null then
    chk := service_area_check(p_lat, p_lng) -> 'data';
    if not coalesce((chk ->> 'inside')::boolean, true) then
      return jsonb_build_object('ok', false, 'code', 'OUT_OF_AREA', 'msg', service_area_msg(), 'data', chk);
    end if;
  end if;
  p_label := left(p_label, 30); p_house := left(p_house, 60); p_street := left(p_street, 300); p_landmark := left(p_landmark, 300);
  if (select count(*) from addresses where customer_id = cid and not hidden) >= 20 and p_address_id is null then
    return jsonb_build_object('ok', false, 'msg', tr('Bahut saare pate save hain — purane hatao','Too many saved addresses — remove some old ones'));
  end if;
  if p_address_id is null then
    insert into addresses (customer_id,label,house_no,street,landmark,area,lat,lng)
    values (cid,p_label,p_house,p_street,p_landmark,p_area,p_lat,p_lng)
    returning * into a;
  else
    update addresses
       set label=p_label, house_no=p_house, street=p_street,
           landmark=p_landmark, area=p_area, lat=p_lat, lng=p_lng
     where id=p_address_id and customer_id=cid returning * into a;
    if a.id is null then
      insert into addresses (customer_id,label,house_no,street,landmark,area,lat,lng)
      values (cid,p_label,p_house,p_street,p_landmark,p_area,p_lat,p_lng)
      returning * into a;
    end if;
  end if;
  if p_make_default then
    update addresses set is_default = (id = a.id) where customer_id = cid;
  end if;
  return jsonb_build_object('ok', true, 'msg', tr('Address save ho gaya','Address saved'), 'data', to_jsonb(a));
end $function$;

-- booking: same rule for the address's pin (only this check is new; the rest is the 17 Oct function unchanged)
create or replace function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text DEFAULT NULL::text, p_vendor_id uuid DEFAULT NULL::uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  cid uuid; addr addresses; vid uuid; bk bookings;
  it jsonb; prod products; total numeric := 0; oos text; item_vendor uuid; n_vendors int; est numeric; minv numeric := min_order();
  chk jsonb;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in')); end if;
  if exists (select 1 from customers where id = cid and is_blocked) then
    return jsonb_build_object('ok', false, 'msg', tr('Aapka account block hai','Your account is blocked'));
  end if;

  select * into addr from addresses where id = p_address_id and customer_id = cid;
  if addr.id is null then return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found')); end if;

  -- 21 Oct 2026: the address's map pin must be inside the service area
  if addr.lat is not null and addr.lng is not null then
    chk := service_area_check(addr.lat, addr.lng) -> 'data';
    if not coalesce((chk ->> 'inside')::boolean, true) then
      return jsonb_build_object('ok', false, 'code', 'OUT_OF_AREA', 'msg', service_area_msg(), 'data', chk);
    end if;
  end if;

  if p_date < ist_date() then
    return jsonb_build_object('ok', false, 'msg', tr('Purani date nahi chun sakte','Cannot pick a past date'));
  end if;
  if p_date > ist_date() + 14 then
    return jsonb_build_object('ok', false, 'msg', tr('2 hafte tak ki hi booking ho sakti hai','You can book up to 2 weeks ahead'));
  end if;
  -- same cut-off as customer_slot_status_for: a slot closes 60 minutes before it starts
  if p_date = ist_date() and ist_now()::time > ((select starts from slot_window(p_slot)) - interval '60 minutes') then
    return jsonb_build_object('ok', false, 'code', 'SLOT_PAST',
      'msg', tr('Aaj ka ye slot band ho chuka hai — dusra slot ya din chuno','This slot has closed for today — please pick another slot or day'));
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'msg', tr('Kam se kam ek saman chuno','Pick at least one item'));
  end if;
  if jsonb_array_length(p_items) > 60 or exists (
       select 1 from jsonb_array_elements(p_items) e
        where jsonb_typeof(e->'qty') is distinct from 'number' or (e->>'qty')::numeric <= 0 or (e->>'qty')::numeric > 100) then
    return jsonb_build_object('ok', false, 'code', 'BAD_QTY', 'msg', tr('Matra sahi nahi hai','Please check the quantities'));
  end if;

  -- items that are out of stock / removed since the page loaded
  select string_agg(coalesce(pr.name, '?'), ', ') into oos
    from jsonb_array_elements(p_items) e
    left join products pr on pr.id = (e->>'product_id')::uuid
   where pr.id is null or not pr.in_stock or pr.review_status <> 'approved';
  if oos is not null then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK',
      'msg', tr('Ye saman abhi stock me nahi hai: ', 'Out of stock right now: ') || oos);
  end if;

  select coalesce(sum((e->>'qty')::numeric * pr.price), 0) into est
    from jsonb_array_elements(p_items) e join products pr on pr.id = (e->>'product_id')::uuid;
  if est < minv then
    return jsonb_build_object('ok', false, 'code', 'BELOW_MIN',
      'msg', tr_dev('कम से कम ₹' || minv || ' का ऑर्डर होना चाहिए', 'The minimum order is ₹' || minv));
  end if;

  if (select count(*) from bookings where customer_id = cid and booking_date = p_date and status not in ('cancelled','missed')) >= 6 then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY',
      'msg', tr('Is din ke liye bahut order ho gaye — pehle wale dekho','You already have many orders for this day — please check My bookings'));
  end if;

  -- no vendor named, but all items are one vendor's: ask that vendor (not whoever match_vendor picks)
  select count(distinct pr.vendor_id), min(pr.vendor_id::text)::uuid into n_vendors, item_vendor
    from jsonb_array_elements(p_items) e join products pr on pr.id = (e->>'product_id')::uuid;
  if p_vendor_id is null and n_vendors = 1 then p_vendor_id := item_vendor; end if;

  if p_vendor_id is not null then
    select v.id into vid
      from vendors v
      left join vendor_slots vs on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = p_slot
     where v.id = p_vendor_id
       and v.status = 'approved' and v.is_active and v.v_type = p_type
       and addr.area = any(v.areas_served)
       and vendor_covers_area_in_slot(v.id, addr.area, p_slot)
       and coalesce(vs.is_open, slot_open_default(v.id, p_slot))
       and coalesce(vs.booked_count, 0) < coalesce(vs.capacity, slot_cap_default(v.id, p_slot));
  end if;
  if vid is null and p_vendor_id is not null then
    return jsonb_build_object('ok', false, 'code', 'VENDOR_FULL',
      'msg', tr('Aapka chuna hua vendor is slot me free nahi hai. Dusra slot ya din chuno.',
                'The vendor you picked is not free in this slot. Please pick another slot or day.'));
  end if;
  if vid is null then
    vid := match_vendor(p_type, addr.area, p_date, p_slot);
  end if;
  if vid is null then
    return jsonb_build_object('ok', false, 'code', 'NO_VENDOR',
      'msg', tr('Is slot me koi vendor free nahi hai. Dusra slot ya din chuno.',
                'No vendor is free in this slot. Please pick another slot or day.'));
  end if;

  -- every item must be this vendor's own
  select string_agg(distinct pr.name, ', ') into oos
    from jsonb_array_elements(p_items) e join products pr on pr.id = (e->>'product_id')::uuid
   where pr.vendor_id is distinct from vid;
  if oos is not null then
    return jsonb_build_object('ok', false, 'code', 'OTHER_VENDOR',
      'msg', tr('Ye saman dusre vendor ka hai — badlo ya hatao: ', 'These items are from another vendor — switch or remove them: ') || oos);
  end if;

  -- two people taking the last place at the same moment: one at a time per vendor/day/slot, then recount
  perform pg_advisory_xact_lock(hashtextextended(vid::text || '|' || p_date::text || '|' || p_slot::text, 0));
  if (select count(*) from bookings where vendor_id = vid and booking_date = p_date and slot = p_slot
        and status not in ('cancelled','missed'))
     >= coalesce((select capacity from vendor_slots where vendor_id = vid and slot_date = p_date and slot = p_slot),
                 slot_cap_default(vid, p_slot)) then
    return jsonb_build_object('ok', false, 'code', 'VENDOR_FULL',
      'msg', tr('Aapka chuna hua vendor is slot me free nahi hai. Dusra slot ya din chuno.',
                'The vendor you picked is not free in this slot. Please pick another slot or day.'));
  end if;

  insert into bookings (customer_id, vendor_id, address_id, v_type, booking_date, slot, note)
  values (cid, vid, p_address_id, p_type, p_date, p_slot, left(p_note, 500))
  returning * into bk;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from products where id = (it->>'product_id')::uuid;
    if prod.id is null then continue; end if;
    insert into booking_items (booking_id, product_id, product_name, unit, image_url, qty, price_at_booking)
    values (bk.id, prod.id, prod.name, prod.unit, prod.image_url, (it->>'qty')::numeric, prod.price);
    total := total + (it->>'qty')::numeric * prod.price;
  end loop;

  update bookings set est_total = total where id = bk.id returning * into bk;

  perform notify_bi((select auth_user_id from vendors where id = vid),
    'vendor','new_booking', bk.code, bk.code,
    'Naya order mila — ' || to_char(p_date,'DD Mon') || ', ' || p_slot,
    'New order — ' || to_char(p_date,'DD Mon') || ', ' || p_slot, bk.id);
  perform log_action('booking_created','booking',bk.id, jsonb_build_object('total',total));

  return jsonb_build_object('ok', true, 'msg', tr('Booking pakki ho gayi','Booking confirmed'),
    'data', jsonb_build_object('id',bk.id,'code',bk.code,'otp',bk.delivery_otp,'est_total',total));
end $function$;

-- admin: change the distance
create or replace function public.admin_set_service_km(p_km numeric)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare old numeric := service_km();
begin
  perform admin_guard();
  if p_km is null or p_km < 1 or p_km > 50 then
    return jsonb_build_object('ok', false, 'msg', 'Doori 1 se 50 km ke beech rakho');
  end if;
  insert into app_settings (key, value, updated_at, updated_by) values ('service_km', to_jsonb(round(p_km, 1)), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform log_action('service_km_changed', 'settings', null, jsonb_build_object('from', old, 'to', round(p_km, 1)));
  return jsonb_build_object('ok', true, 'msg', 'Service area ab ' || round(p_km, 1) || ' km hai');
end $function$;
revoke execute on function public.admin_set_service_km(numeric) from public, anon;
grant execute on function public.admin_set_service_km(numeric) to authenticated;

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
    'gali_orders_all', (select count(*) from bookings where gali_notified_at is not null),
    'service_km', service_km(),
    'service_km_updated_at', (select updated_at from app_settings where key = 'service_km'),
    'service_villages', (select coalesce(jsonb_agg(name order by sort_order nulls last, name), '[]'::jsonb)
                           from areas where is_active and lat is not null and lng is not null),
    'service_outside_addresses', (select count(*) from addresses a where a.lat is not null and not coalesce(a.hidden, false)
                                    and not coalesce((service_area_check(a.lat, a.lng) -> 'data' ->> 'inside')::boolean, true))));
end $function$;

create or replace function public.public_app_config()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('min_order', min_order(), 'otp', customer_otp_on(),
    'gali', (select jsonb_build_object('on', c -> 'on', 'min', c -> 'min', 'bonus_hi', c -> 'bonus_hi', 'bonus_en', c -> 'bonus_en') from gali_cfg() c),
    'service_km', service_km()));
$function$;
