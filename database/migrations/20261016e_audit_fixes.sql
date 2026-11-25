-- 16 Oct 2026 — fixes from the deep loophole audit (customer, vendor, staff, anonymous visitors).
--  Anonymous visitors
--   * customer_join_waitlist: real village + phone only, the same request once a day, and the admin push stops
--     after 10 requests an hour (calling it in a loop used to push every admin's phone each time).
--   * customer_send_message: length limits + at most 5 messages an hour per account / phone, 100 an hour overall.
--   * log_visit: at most 600 rows a minute.
--  Customers
--   * customer_phone_login: joining an existing account by number no longer renames it to whatever was typed,
--     and the account's devices are told "opened on a new phone" (no SMS check exists yet — this is the warning).
--   * customer_save_address: village must exist, text lengths and GPS ranges checked.
--   * customer_create_booking: a per vendor/day/slot lock + recount, so two people can't both take the last place.
--   * customer_create_schedule (repeat orders, unused by every app) can no longer be called — it made 21 days of
--     bookings without any of the booking checks.
--   * cancel reasons cut to 300 characters.
--  Vendors
--   * prices must be > 0 and ≤ ₹1,00,000 (bulk price update, product save, catalogue item) — ₹0 / negative /
--     ₹10 lakh were accepted.
--   * renaming an approved item, or a new photo, sends it back for approval (it used to stay live unchecked);
--     photos must be real image data (rb_valid_photo); names/units have length limits.
--   * vendor_update_profile: real villages only, capacity 1–60, photo must be image data (any https link was
--     accepted and then loaded on every customer's phone).
--   * vendor_apply: not from an anonymous session, 10-digit phone, real villages, admin push capped per hour.
--   * vendor_set_capacity: 0–60, within the next 60 days.
--   * vendor_finalize_bill: a bill rate may be at most double the booked rate (+₹20) — the bill could charge up to
--     ₹1,00,000 a unit; door-added items with qty 0 no longer break the bill.
--  Staff
--   * team_post_save / team_issue_save: editing someone else's post / bug needs to be its author, the assignee
--     (bugs) or an admin.

-- ======================= anonymous visitors =======================
create or replace function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cid uuid := my_customer_id(); ph text := nullif(right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10), '');
begin
  if not exists (select 1 from areas where name = p_area) then
    return jsonb_build_object('ok', false, 'msg', tr('Gaon chuno','Choose your village'));
  end if;
  if ph is null and cid is not null then ph := (select phone from customers where id = cid); end if;
  if ph is not null and length(ph) <> 10 then ph := null; end if;
  if ph is null and cid is null then
    return jsonb_build_object('ok', false, 'msg', tr('Phone number daalo','Enter your phone number'));
  end if;
  -- the same person asking again the same day is fine — noted once
  if exists (select 1 from waitlist where area = p_area and v_type = p_type and created_at > now() - interval '1 day'
              and ((ph is not null and phone = ph) or (cid is not null and customer_id = cid))) then
    return jsonb_build_object('ok', true, 'msg', tr('Jab vendor aayega hum aapko batayenge', 'Jab vendor aayega hum aapko batayenge'));
  end if;
  insert into waitlist (customer_id, area, v_type, phone) values (cid, p_area, p_type, ph);
  if (select count(*) from waitlist where created_at > now() - interval '1 hour') <= 10 then
    perform notify_user(null,'admin','waitlist', p_area, p_area || ' me ' || p_type || ' vendor ki demand hai', null);
  end if;
  return jsonb_build_object('ok', true, 'msg', tr('Jab vendor aayega hum aapko batayenge', 'Jab vendor aayega hum aapko batayenge'));
end $function$;

create or replace function public.customer_send_message(p_name text, p_body text, p_phone text default null, p_email text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare mid uuid; cid uuid := my_customer_id(); ph text := nullif(left(trim(coalesce(p_phone,'')), 15), '');
begin
  if length(trim(coalesce(p_name,''))) < 1 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam likhiye', 'Naam likhiye'));
  end if;
  if length(trim(coalesce(p_body,''))) < 3 then
    return jsonb_build_object('ok', false, 'msg', tr('Message thoda lamba likhiye', 'Message thoda lamba likhiye'));
  end if;
  if length(p_body) > 2000 then
    return jsonb_build_object('ok', false, 'msg', tr('Message bahut lamba hai','The message is too long'));
  end if;
  if (select count(*) from messages where created_at > now() - interval '1 hour'
        and ((cid is not null and customer_id = cid) or (ph is not null and phone = ph))) >= 5
     or (select count(*) from messages where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'msg', tr('Thodi der baad bhejiye','Please try again a little later'));
  end if;
  insert into messages (name, body, phone, email, customer_id)
  values (left(trim(p_name), 80), trim(p_body), ph, nullif(left(trim(coalesce(p_email,'')), 120),''), cid)
  returning id into mid;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', mid));
end $function$;

create or replace function public.log_visit(p_page text)
 returns void language sql security definer set search_path to 'public', 'pg_temp'
as $function$
  insert into site_visits(page)
  select left(coalesce(p_page,'unknown'), 20)
   where (select count(*) from site_visits where created_at > now() - interval '1 minute') < 600;
$function$;

-- ======================= customers =======================
create or replace function public.customer_phone_login(p_name text, p_phone text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare c customers; existing_own customers; clean_phone text; was_linked uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'msg', tr('Session nahi mila — dubara try karo', 'Session nahi mila — dubara try karo'));
  end if;
  clean_phone := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if length(clean_phone) <> 10 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi 10-digit number daalo', 'Sahi 10-digit number daalo'));
  end if;
  if customer_otp_on() and coalesce((select phone from auth.users where id = auth.uid()), '') <> '91' || clean_phone then
    return jsonb_build_object('ok', false, 'code', 'OTP_REQUIRED', 'msg', tr('Pehle SMS wala code daalo', 'Enter the code we sent by SMS first'));
  end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(trim(p_name)) > 80 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo', 'Naam daalo'));
  end if;

  select * into c from customers where phone = clean_phone;
  select * into existing_own from customers where auth_user_id = auth.uid();

  if existing_own.id is not null then
    if c.id is not null and c.id <> existing_own.id then
      update customers set phone = null where id = c.id;
    end if;
    update customers set phone = clean_phone, name = trim(p_name)
     where id = existing_own.id returning * into c;
  elsif c.id is not null then
    -- this number already has an account: this device joins it. The account keeps ITS name (whatever was
    -- typed here used to overwrite it), and the account's devices are told about the new login.
    select customer_id into was_linked from customer_logins where auth_user_id = auth.uid();
    insert into customer_logins (auth_user_id, customer_id) values (auth.uid(), c.id)
      on conflict (auth_user_id) do update set customer_id = excluded.customer_id, created_at = now();
    if c.name is null or trim(c.name) = '' then
      update customers set name = trim(p_name) where id = c.id returning * into c;
    end if;
    if was_linked is distinct from c.id then
      perform notify_bi(c.auth_user_id, 'customer', 'new_login',
        '🔐 नए फ़ोन पर लॉगिन', '🔐 New login on your account',
        'आपका RozBazaar खाता एक नए फ़ोन या कंप्यूटर पर खोला गया। अगर यह आप नहीं थे, तो हमें तुरंत बताएँ।',
        'Your RozBazaar account was opened on a new phone or computer. If this was not you, tell us right away.', null);
    end if;
  else
    delete from customer_logins where auth_user_id = auth.uid();
    insert into customers (auth_user_id, name, phone, auth_provider)
    values (auth.uid(), trim(p_name), clean_phone, 'phone')
    returning * into c;
  end if;

  return jsonb_build_object('ok', true, 'data', to_jsonb(c));
end $function$;

create or replace function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text, p_lat double precision default null, p_lng double precision default null, p_make_default boolean default true, p_address_id uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cid uuid; a addresses;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if coalesce(trim(p_area),'') = '' or not exists (select 1 from areas where name = p_area) then
    return jsonb_build_object('ok', false, 'msg', tr('Gaon chuno','Choose your village'));
  end if;
  if (p_lat is not null and (p_lat < -90 or p_lat > 90)) or (p_lng is not null and (p_lng < -180 or p_lng > 180)) then
    p_lat := null; p_lng := null;
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

create or replace function public.customer_cancel_booking(p_booking uuid, p_reason text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Booking nahi mili', 'Booking nahi mili')); end if;
  if bk.status not in ('placed','on_the_way') then
    return jsonb_build_object('ok', false, 'msg', tr('Vendor pahunch chuka hai, ab cancel nahi hoga', 'Vendor pahunch chuka hai, ab cancel nahi hoga'));
  end if;
  update bookings set status='cancelled', cancel_reason=coalesce(left(p_reason, 300),'Customer ne cancel kiya')
   where id=p_booking;
  perform notify_user((select auth_user_id from vendors where id=bk.vendor_id),
    'vendor','cancelled',bk.code,'Customer ne order cancel kar diya',bk.id);
  return jsonb_build_object('ok', true, 'msg', tr('Order cancel ho gaya', 'Order cancel ho gaya'));
end $function$;

revoke execute on function public.customer_create_schedule(vendor_type, uuid, integer[], time_slot, date, date, jsonb) from public, anon, authenticated;

-- ======================= vendors =======================
create or replace function public.vendor_bulk_prices(p_prices jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare vid uuid; it jsonb; n int := 0; bad int := 0; pr numeric;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if jsonb_typeof(coalesce(p_prices,'null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'msg', tr('Kuch galat hua','Something went wrong'));
  end if;
  for it in select * from jsonb_array_elements(p_prices) loop
    begin pr := (it->>'price')::numeric; exception when others then pr := null; end;
    if pr is null or pr <= 0 or pr > 100000 then bad := bad + 1; continue; end if;
    update products set price = pr
     where id = (it->>'id')::uuid and vendor_id = vid and price is distinct from pr;
    if found then n := n + 1; end if;
  end loop;
  if bad > 0 and n = 0 then
    return jsonb_build_object('ok', false, 'msg', tr('Rate ₹1 se ₹1,00,000 ke beech rakho','Keep each rate between ₹1 and ₹1,00,000'));
  end if;
  return jsonb_build_object('ok', true, 'msg', tr(n || ' rate update ho gaye', n || ' prices updated'));
end $function$;

create or replace function public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text default null, p_sort integer default 0, p_product_id uuid default null, p_name_hi text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare vid uuid; p products; old products; recheck boolean;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  if p_price is null or p_price <= 0 or p_price > 100000 then
    return jsonb_build_object('ok', false, 'msg', tr('Rate ₹1 se ₹1,00,000 ke beech rakho','Keep the rate between ₹1 and ₹1,00,000'));
  end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(trim(p_name)) > 60 or length(coalesce(p_name_hi,'')) > 60
     or length(trim(coalesce(p_unit,''))) < 1 or length(p_unit) > 30 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam aur unit sahi likho','Check the name and unit'));
  end if;
  if p_category is null or p_category not in ('vegetable','fruit','onion_potato') then
    return jsonb_build_object('ok', false, 'msg', tr('Category chuno','Choose a category'));
  end if;
  if not rb_valid_photo(p_image) then
    return jsonb_build_object('ok', false, 'msg', tr('Ye photo nahi chalegi','This photo cannot be used'));
  end if;

  if p_product_id is null then
    insert into products (vendor_id,name,name_hi,unit,price,category,image_url,sort_order,review_status)
    values (vid,trim(p_name),nullif(trim(coalesce(p_name_hi,'')),''),trim(p_unit),p_price,p_category::vendor_type,p_image,coalesce(p_sort,0),'pending')
    returning * into p;
    return jsonb_build_object('ok', true,
      'msg', tr('Bhej diya — admin ke approve karte hi customer ko dikhega','Sent — it will show to customers once an admin approves it'),
      'data', to_jsonb(p));
  else
    select * into old from products where id=p_product_id and vendor_id=vid;
    if old.id is null then return jsonb_build_object('ok', false, 'msg', 'Product nahi mila'); end if;
    -- a new name or photo on an approved item goes back for approval (it used to go live unchecked)
    recheck := old.review_status = 'approved'
               and (lower(trim(old.name)) is distinct from lower(trim(p_name))
                    or (p_image is not null and p_image is distinct from old.image_url));
    update products set name=trim(p_name), name_hi=nullif(trim(coalesce(p_name_hi,'')),''), unit=trim(p_unit), price=p_price,
           category=p_category::vendor_type, image_url=coalesce(p_image,image_url), sort_order=coalesce(p_sort,0),
           review_status = case when recheck then 'pending' else review_status end
     where id=p_product_id and vendor_id=vid returning * into p;
    return jsonb_build_object('ok', true,
      'msg', case when recheck then tr('Naya naam/photo admin ke approve karne ke baad dikhega','The new name/photo will show once an admin approves it')
                  else tr('Save ho gaya','Saved') end,
      'data', to_jsonb(p));
  end if;
end $function$;

create or replace function public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare vid uuid := my_vendor_id(); c catalog_items; p products;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if p_price is null or p_price <= 0 or p_price > 100000 then
    return jsonb_build_object('ok', false, 'msg', tr('Rate ₹1 se ₹1,00,000 ke beech rakho','Keep the rate between ₹1 and ₹1,00,000'));
  end if;
  if length(coalesce(p_unit,'')) > 30 then return jsonb_build_object('ok', false, 'msg', tr('Unit sahi likho','Check the unit')); end if;
  select * into c from catalog_items where key = p_key and is_active;
  if c.key is null then return jsonb_build_object('ok', false, 'msg', 'Ye item catalog me nahi mila'); end if;

  insert into products (vendor_id, name, name_hi, unit, price, category, catalog_key, in_stock, review_status)
  values (vid, c.name_en, c.name_hi, coalesce(nullif(trim(p_unit),''), c.default_unit), p_price, c.category::vendor_type, c.key, true, 'approved')
  on conflict (vendor_id, catalog_key) where catalog_key is not null
  do update set price = excluded.price, unit = excluded.unit, in_stock = true, price_updated_at = now()
  returning * into p;
  return jsonb_build_object('ok', true, 'data', to_jsonb(p));
end $function$;

create or replace function public.vendor_update_profile(p_name text default null, p_shop text default null, p_vehicle text default null, p_areas text[] default null, p_capacity integer default null, p_photo text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v vendors;
begin
  if p_name is not null and (length(trim(p_name)) < 1 or length(trim(p_name)) > 60) then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi naam daalo','Enter a valid name'));
  end if;
  if p_areas is not null and (array_length(p_areas,1) is null or array_length(p_areas,1) > 30
       or exists (select 1 from unnest(p_areas) a where a not in (select name from areas))) then
    return jsonb_build_object('ok', false, 'msg', tr('Gaon list me se hi chuno','Pick villages from the list'));
  end if;
  if p_capacity is not null and (p_capacity < 1 or p_capacity > 60) then
    return jsonb_build_object('ok', false, 'msg', tr('Orders 1 se 60 ke beech rakho','Keep orders between 1 and 60'));
  end if;
  if not rb_valid_photo(p_photo) then
    return jsonb_build_object('ok', false, 'msg', tr('Ye photo nahi chalegi','This photo cannot be used'));
  end if;
  update vendors set
    name             = coalesce(trim(p_name), name),
    shop_name        = coalesce(left(trim(p_shop), 80), shop_name),
    vehicle          = coalesce(left(trim(p_vehicle), 40), vehicle),
    areas_served     = coalesce(p_areas, areas_served),
    default_capacity = coalesce(p_capacity, default_capacity),
    photo_url        = coalesce(p_photo, photo_url)
  where auth_user_id = auth.uid() returning * into v;
  if v.id is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Save ho gaya', 'data', to_jsonb(v));
end $function$;

create or replace function public.vendor_apply(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text default null, p_vehicle text default null, p_capacity integer default 15, p_lang text default 'en')
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v vendors; L text := case when p_lang='hi' then 'hi' else 'en' end;
        ph text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10);
begin
  if auth.uid() is null or coalesce((select is_anonymous from auth.users where id = auth.uid()), false) then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'Please log in first' else 'Pehle login karo' end);
  end if;
  if exists (select 1 from vendors where auth_user_id = auth.uid()) then
    select * into v from vendors where auth_user_id = auth.uid();
    return jsonb_build_object('ok', true,
      'msg', case when L='en' then 'You have already applied' else 'Aapka application pehle se hai' end,
      'data', jsonb_build_object('status', v.status, 'id', v.id));
  end if;
  if length(ph) <> 10 then
    return jsonb_build_object('ok', false, 'msg', case when L='en' then 'Enter a 10-digit phone number' else '10 digit ka phone number daalo' end);
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 60 then
    return jsonb_build_object('ok', false, 'msg', case when L='en' then 'Enter your name' else 'Naam daalo' end);
  end if;
  if exists (select 1 from vendors where phone = ph) then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'This phone number is already registered'
                  else 'Ye phone number pehle se juda hai' end);
  end if;
  if array_length(p_areas,1) is null or array_length(p_areas,1) > 30
     or exists (select 1 from unnest(p_areas) a where a not in (select name from areas)) then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'Pick at least one area' else 'Kam se kam ek area chuno' end);
  end if;

  insert into vendors (auth_user_id,name,phone,shop_name,v_type,vehicle,areas_served,
                       default_capacity,status,lang)
  values (auth.uid(),trim(p_name),ph,left(trim(p_shop),80),p_type,left(trim(p_vehicle),40),p_areas,
          greatest(1, least(coalesce(p_capacity,15), 60)),'pending',L)
  returning * into v;

  if (select count(*) from vendors where applied_at > now() - interval '1 hour') <= 10 then
    perform notify_bi(null,'admin','vendor_application', v.name, v.name,
      v.name || ' (' || ph || ') ne vendor banne ke liye apply kiya',
      v.name || ' (' || ph || ') applied to become a vendor', null);
  end if;
  perform log_action('vendor_applied','vendor',v.id,null);

  return jsonb_build_object('ok', true,
    'msg', case when L='en' then 'Application sent — admin will review'
                else 'Application bhej diya — admin check karega' end,
    'data', jsonb_build_object('id', v.id, 'status', v.status));
end $function$;

create or replace function public.vendor_set_capacity(p_date date, p_slot time_slot, p_capacity integer, p_open boolean default true)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare vid uuid; booked int;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if p_capacity is null or p_capacity < 0 or p_capacity > 60 then
    return jsonb_build_object('ok', false, 'msg', tr('Orders 0 se 60 ke beech rakho','Keep orders between 0 and 60'));
  end if;
  if p_date is null or p_date < ist_date() or p_date > ist_date() + 60 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi din chuno','Pick a valid day'));
  end if;
  select coalesce(booked_count,0) into booked from vendor_slots
   where vendor_id=vid and slot_date=p_date and slot=p_slot;
  if booked is not null and p_capacity < booked then
    return jsonb_build_object('ok', false, 'msg',
      tr('Pehle se ' || booked || ' order hain — capacity isse kam nahi ho sakti',
         'Already ' || booked || ' orders — capacity cannot go below that'));
  end if;
  insert into vendor_slots (vendor_id,slot_date,slot,capacity,is_open)
  values (vid,p_date,p_slot,p_capacity,coalesce(p_open,true))
  on conflict (vendor_id,slot_date,slot)
    do update set capacity=excluded.capacity, is_open=excluded.is_open;
  return jsonb_build_object('ok', true, 'msg', tr('Capacity set ho gayi','Capacity saved'));
end $function$;

create or replace function public.vendor_cancel_booking(p_booking uuid, p_reason text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if coalesce(trim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'msg', tr('Wajah likhna zaroori hai','A reason is required'));
  end if;
  if bk.status not in ('placed','on_the_way','reached') then
    return jsonb_build_object('ok', false, 'msg', tr('Bill ke baad order cancel nahi hota — admin se baat karo','An order cannot be cancelled after the bill — please contact admin'));
  end if;
  update bookings set status='cancelled', cancel_reason='Vendor: '||left(trim(p_reason), 300) where id=p_booking;
  perform notify_bi((select auth_user_id from customers where id=bk.customer_id),
    'customer','cancelled',bk.code,bk.code,
    'Vendor order nahi kar paya: '||left(trim(p_reason), 200),
    'Vendor could not fulfil this order: '||left(trim(p_reason), 200), bk.id);
  return jsonb_build_object('ok', true, 'msg',
    tr('Cancel ho gaya, customer ko bata diya','Cancelled, customer notified'));
end $function$;

create or replace function public.vendor_finalize_bill(p_booking uuid, p_items jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings; it jsonb; prod products; total numeric := 0; bi booking_items; q numeric; pr numeric;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if bk.status not in ('reached','bill_final','on_the_way','disputed') then
    return jsonb_build_object('ok', false, 'msg', tr('Abhi bill final nahi kar sakte','Cannot finalize yet'));
  end if;

  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or exists (
       select 1 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e
       where coalesce((e->>'final_qty')::numeric, 0) < 0 or coalesce((e->>'final_qty')::numeric, 0) > 1000
          or coalesce((e->>'final_price')::numeric, 0) < 0 or coalesce((e->>'final_price')::numeric, 0) > 100000) then
    return jsonb_build_object('ok', false, 'msg', tr('Matra ya rate galat hai','A quantity or rate is not valid'));
  end if;
  -- a bill rate may be at most double the booked rate (+₹20): a typo or an inflated rate can't reach the bill
  for it in select * from jsonb_array_elements(p_items) loop
    pr := (it->>'final_price')::numeric;
    if pr is null then continue; end if;
    if it ? 'item_id' then
      select * into bi from booking_items where id = (it->>'item_id')::uuid and booking_id = p_booking;
      if bi.id is not null and pr > bi.price_at_booking * 2 + 20 then
        return jsonb_build_object('ok', false, 'msg',
          tr(bi.product_name || ' ka rate booking ke rate (₹' || round(bi.price_at_booking) || ') se double se zyada hai',
             'The rate for ' || bi.product_name || ' is more than double the booked rate (₹' || round(bi.price_at_booking) || ')'));
      end if;
    else
      select * into prod from products where id = (it->>'product_id')::uuid and vendor_id = bk.vendor_id;
      if prod.id is not null and pr > prod.price * 2 + 20 then
        return jsonb_build_object('ok', false, 'msg',
          tr(prod.name || ' ka rate aapke app wale rate (₹' || round(prod.price) || ') se double se zyada hai',
             'The rate for ' || prod.name || ' is more than double your app rate (₹' || round(prod.price) || ')'));
      end if;
    end if;
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    if it ? 'item_id' then
      update booking_items
         set final_qty   = coalesce((it->>'final_qty')::numeric, qty),
             final_price = coalesce((it->>'final_price')::numeric, price_at_booking),
             removed     = coalesce((it->>'removed')::boolean, false)
       where id = (it->>'item_id')::uuid and booking_id = p_booking;
    else
      q := (it->>'final_qty')::numeric;
      if q is null or q <= 0 then continue; end if;          -- an item added at the door needs a quantity
      select * into prod from products where id = (it->>'product_id')::uuid and vendor_id = bk.vendor_id;
      if prod.id is null then continue; end if;
      insert into booking_items (booking_id,product_id,product_name,unit,image_url,
                                 qty,price_at_booking,final_qty,final_price,added_at_door)
      values (p_booking,prod.id,prod.name,prod.unit,prod.image_url, q,
              coalesce((it->>'final_price')::numeric, prod.price), q,
              coalesce((it->>'final_price')::numeric, prod.price), true);
    end if;
  end loop;

  select coalesce(sum(case when removed then 0
                    else coalesce(final_qty,qty) * coalesce(final_price,price_at_booking) end),0)
    into total from booking_items where booking_id = p_booking;

  update bookings set final_total = total, status='bill_final', bill_final_at = now()
   where id = p_booking;

  perform notify_bi((select auth_user_id from customers where id = bk.customer_id),
    'customer','bill_final', bk.code, bk.code,
    'Bill taiyaar hai — ₹' || total || '. Check karke approve karo',
    'Bill ready — ₹' || total || '. Please review and approve', bk.id);

  return jsonb_build_object('ok', true, 'msg', tr('Bill customer ko bhej diya','Bill sent to customer'),
    'data', jsonb_build_object('final_total', total));
end $function$;

-- ======================= staff =======================
create or replace function public.team_post_save(p_id uuid, p_title text, p_platform text, p_date date, p_time time without time zone, p_caption text, p_hashtags text, p_status text, p_link text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare p content_posts;
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give the post a title'); end if;
  if coalesce(p_status,'') not in ('idea','draft','ready','posted') then p_status := 'idea'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  if p_id is null then
    insert into content_posts (title, platform, post_date, post_time, caption, hashtags, status, link, owner_staff, created_by, created_by_name)
    values (left(trim(p_title),150), coalesce(nullif(trim(p_platform),''),'Instagram'), p_date, p_time, nullif(trim(coalesce(p_caption,'')),''),
            nullif(trim(coalesce(p_hashtags,'')),''), p_status, nullif(trim(coalesce(p_link,'')),''), my_staff_id(), auth.uid(), team_who())
    returning * into p;
  else
    update content_posts set title = left(trim(p_title),150), platform = coalesce(nullif(trim(p_platform),''),'Instagram'), post_date = p_date,
           post_time = p_time, caption = nullif(trim(coalesce(p_caption,'')),''), hashtags = nullif(trim(coalesce(p_hashtags,'')),''),
           status = p_status, link = nullif(trim(coalesce(p_link,'')),''), updated_at = now()
     where id = p_id and (is_admin() or created_by = auth.uid()) returning * into p;
    if p.id is null then return jsonb_build_object('ok', false, 'msg', 'Only the person who added it can change it'); end if;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(p));
end $function$;

create or replace function public.team_issue_save(p_id uuid, p_kind text, p_app text, p_title text, p_details text, p_severity text, p_status text, p_link text, p_assignee uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare i dev_issues; r uuid; isnew boolean := p_id is null; old_assignee uuid; me uuid := my_staff_id();
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if not isnew then
    select assignee into old_assignee from dev_issues where id = p_id
       and (is_admin() or created_by = auth.uid() or (me is not null and assignee = me));
    if not found then return jsonb_build_object('ok', false, 'msg', 'Only the person who added it, the assignee or an admin can change it'); end if;
  end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Write a short title'); end if;
  if coalesce(p_kind,'') not in ('bug','feature','idea') then p_kind := 'bug'; end if;
  if coalesce(p_app,'') not in ('customer','vendor','staff','admin','website','other') then p_app := 'other'; end if;
  if coalesce(p_severity,'') not in ('low','normal','high','critical') then p_severity := 'normal'; end if;
  if coalesce(p_status,'') not in ('open','in_progress','fixed','wont_fix') then p_status := 'open'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  if p_assignee is not null and not exists (select 1 from staff where id = p_assignee and is_active) then p_assignee := null; end if;
  if isnew then
    insert into dev_issues (kind, app, title, details, severity, status, link, assignee, created_by, created_by_name)
    values (p_kind, p_app, left(trim(p_title),200), nullif(trim(coalesce(p_details,'')),''), p_severity, p_status,
            nullif(trim(coalesce(p_link,'')),''), p_assignee, auth.uid(), team_who())
    returning * into i;
  else
    update dev_issues set kind = p_kind, app = p_app, title = left(trim(p_title),200), details = nullif(trim(coalesce(p_details,'')),''),
           severity = p_severity, status = p_status, link = nullif(trim(coalesce(p_link,'')),''), assignee = p_assignee, updated_at = now(),
           closed_at = case when p_status in ('fixed','wont_fix') then coalesce(closed_at, now()) else null end
     where id = p_id returning * into i;
    if i.id is null then return jsonb_build_object('ok', false, 'msg', 'Not found'); end if;
  end if;
  if isnew and (i.kind = 'bug' and i.severity in ('high','critical')) and not is_admin() then
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'issue', case when i.severity = 'critical' then '🚨 Critical bug' else '🐞 High bug' end || ' · ' || i.app, i.title);
    end loop;
  end if;
  if i.assignee is not null and i.assignee is distinct from old_assignee then
    select auth_user_id into r from staff where id = i.assignee;
    if r is not null and r is distinct from auth.uid() then
      perform team_notify(r, 'staff', 'issue',
        case i.kind when 'bug' then '🐞 Bug for you' when 'feature' then '✨ Feature for you' else '💡 Idea for you' end, i.title);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(i));
end $function$;

-- ======================= booking: no double-booking of the last place =======================
create or replace function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text default null, p_vendor_id uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  cid uuid; addr addresses; vid uuid; bk bookings;
  it jsonb; prod products; total numeric := 0; oos text; item_vendor uuid; n_vendors int; est numeric; minv numeric := min_order();
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in')); end if;
  if exists (select 1 from customers where id = cid and is_blocked) then
    return jsonb_build_object('ok', false, 'msg', tr('Aapka account block hai','Your account is blocked'));
  end if;

  select * into addr from addresses where id = p_address_id and customer_id = cid;
  if addr.id is null then return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found')); end if;

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
      'msg', tr('Kam se kam ₹' || minv || ' ka order hona chahiye', 'The minimum order is ₹' || minv));
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
