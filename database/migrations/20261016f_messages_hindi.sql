-- 16/17 Oct 2026 — messages from the 16 Oct fixes in proper Hindi (Devanagari) / English.
-- tr() only translates messages found in msg_i18n; 26 new ones were missing, so a Hindi-mode vendor/customer
-- saw Roman Hindi ("Rate ₹1 se ₹1,00,000 ke beech rakho"). Messages that contain a number or an item name
-- can't be looked up in a table — they use tr_dev(devanagari, english) instead.

create or replace function public.tr_dev(p_hi text, p_en text)
 returns text language sql stable set search_path to 'public'
as $function$ select case when my_lang() = 'en' then p_en else p_hi end; $function$;
revoke execute on function public.tr_dev(text, text) from public, anon, authenticated;

insert into msg_i18n (roman, hi, en)
select v.roman, v.hi, v.en from (values
  ('Login', 'लॉगिन', 'Login'),
  ('Tokri bahut bhari hai', 'टोकरी बहुत भरी है', 'Your basket is too full'),
  ('Ye saman dusre vendor ka hai — badlo ya hatao: ', 'ये सामान दूसरे वेंडर का है — बदलें या हटाएँ: ', 'These items are from another vendor — switch or remove them: '),
  ('2 hafte tak ki hi booking ho sakti hai', '2 हफ़्ते आगे तक की ही बुकिंग हो सकती है', 'You can book up to 2 weeks ahead'),
  ('Aaj ka ye slot band ho chuka hai — dusra slot ya din chuno', 'आज का ये स्लॉट बंद हो चुका है — दूसरा स्लॉट या दिन चुनें', 'This slot has closed for today — please pick another slot or day'),
  ('Matra sahi nahi hai', 'मात्रा सही नहीं है', 'Please check the quantities'),
  ('Is din ke liye bahut order ho gaye — pehle wale dekho', 'इस दिन के लिए बहुत ऑर्डर हो गए — पहले वाले देखें', 'You already have many orders for this day — please check My bookings'),
  ('Pehle customer se bill approve karwao', 'पहले ग्राहक से बिल मंज़ूर करवाएँ', 'Get the bill approved by the customer first'),
  ('Payment record ho gaya — ab OTP daalo', 'पेमेंट दर्ज हो गया — अब डिलीवरी कोड डालें', 'Payment recorded — now enter the delivery code'),
  ('Phone number daalo', 'फ़ोन नंबर डालें', 'Enter your phone number'),
  ('Message bahut lamba hai', 'संदेश बहुत लंबा है', 'The message is too long'),
  ('Thodi der baad bhejiye', 'थोड़ी देर बाद भेजें', 'Please try again a little later'),
  ('Bahut saare pate save hain — purane hatao', 'बहुत सारे पते सेव हैं — पुराने हटाएँ', 'Too many saved addresses — remove some old ones'),
  ('Rate ₹1 se ₹1,00,000 ke beech rakho', 'रेट ₹1 से ₹1,00,000 के बीच रखें', 'Keep the rate between ₹1 and ₹1,00,000'),
  ('Naam aur unit sahi likho', 'नाम और यूनिट सही लिखें', 'Check the name and unit'),
  ('Category chuno', 'कैटेगरी चुनें', 'Choose a category'),
  ('Bhej diya — admin ke approve karte hi customer ko dikhega', 'भेज दिया — एडमिन की मंज़ूरी के बाद ग्राहकों को दिखेगा', 'Sent — it will show to customers once an admin approves it'),
  ('Naya naam/photo admin ke approve karne ke baad dikhega', 'नया नाम/फ़ोटो एडमिन की मंज़ूरी के बाद दिखेगा', 'The new name/photo will show once an admin approves it'),
  ('Unit sahi likho', 'यूनिट सही लिखें', 'Check the unit'),
  ('Sahi naam daalo', 'सही नाम डालें', 'Enter a valid name'),
  ('Gaon list me se hi chuno', 'गाँव सूची में से ही चुनें', 'Pick villages from the list'),
  ('Orders 0 se 60 ke beech rakho', 'ऑर्डर 0 से 60 के बीच रखें', 'Keep orders between 0 and 60'),
  ('Sahi din chuno', 'सही दिन चुनें', 'Pick a valid day'),
  ('Capacity set ho gayi', 'क्षमता सेव हो गई', 'Capacity saved'),
  ('Wajah likhna zaroori hai', 'वजह लिखना ज़रूरी है', 'A reason is required'),
  ('Cancel ho gaya, customer ko bata diya', 'कैंसल हो गया, ग्राहक को बता दिया', 'Cancelled, customer notified')
) v(roman, hi, en)
where not exists (select 1 from msg_i18n m where m.roman = v.roman);

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
  return jsonb_build_object('ok', true, 'msg', tr_dev(n || ' रेट अपडेट हो गए', n || ' prices updated'));
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
      tr_dev('पहले से ' || booked || ' ऑर्डर हैं — क्षमता इससे कम नहीं हो सकती',
         'Already ' || booked || ' orders — capacity cannot go below that'));
  end if;
  insert into vendor_slots (vendor_id,slot_date,slot,capacity,is_open)
  values (vid,p_date,p_slot,p_capacity,coalesce(p_open,true))
  on conflict (vendor_id,slot_date,slot)
    do update set capacity=excluded.capacity, is_open=excluded.is_open;
  return jsonb_build_object('ok', true, 'msg', tr('Capacity set ho gayi','Capacity saved'));
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
          tr_dev(bi.product_name || ' का रेट बुकिंग वाले रेट (₹' || round(bi.price_at_booking) || ') के दोगुने से ज़्यादा है',
             'The rate for ' || bi.product_name || ' is more than double the booked rate (₹' || round(bi.price_at_booking) || ')'));
      end if;
    else
      select * into prod from products where id = (it->>'product_id')::uuid and vendor_id = bk.vendor_id;
      if prod.id is not null and pr > prod.price * 2 + 20 then
        return jsonb_build_object('ok', false, 'msg',
          tr_dev(prod.name || ' का रेट आपके ऐप वाले रेट (₹' || round(prod.price) || ') के दोगुने से ज़्यादा है',
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
    'customer','bill_final', '🧾 बिल तैयार है', '🧾 Your bill is ready',
    'ऑर्डर ' || bk.code || ' — बिल ₹' || trim_scale(total) || '। देखकर मंज़ूर करें।',
    'Order ' || bk.code || ' — bill ₹' || trim_scale(total) || '. Please check and approve.', bk.id);

  return jsonb_build_object('ok', true, 'msg', tr('Bill customer ko bhej diya','Bill sent to customer'),
    'data', jsonb_build_object('final_total', total));
end $function$;

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

-- the customer's "order cancelled" notifications were Roman Hindi with only the order code as the title
create or replace function public.admin_cancel_booking(p_booking uuid, p_reason text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare bk bookings; why text := left(trim(coalesce(p_reason,'')), 300);
begin
  perform admin_guard();
  if why = '' then
    return jsonb_build_object('ok', false, 'msg', 'A reason is required');
  end if;
  select * into bk from bookings where id = p_booking;
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', 'Booking not found'); end if;
  if bk.status in ('completed','delivered','cancelled') then
    return jsonb_build_object('ok', false, 'msg',
      'Already ' || bk.status || ' — cannot cancel a booking that''s already finished');
  end if;

  update bookings set status='cancelled', cancel_reason='Admin: '||why where id=p_booking;

  perform notify_bi((select auth_user_id from customers where id=bk.customer_id),
    'customer','cancelled', '❌ ऑर्डर कैंसल हुआ', '❌ Order cancelled',
    'RozBazaar ने ऑर्डर ' || bk.code || ' कैंसल किया: ' || left(why, 200),
    'RozBazaar cancelled order ' || bk.code || ': ' || left(why, 200), bk.id);
  perform notify_bi((select auth_user_id from vendors where id=bk.vendor_id),
    'vendor','cancelled', '❌ ऑर्डर कैंसल हुआ', '❌ Order cancelled',
    'RozBazaar ने ऑर्डर ' || bk.code || ' कैंसल किया: ' || left(why, 200),
    'RozBazaar cancelled order ' || bk.code || ': ' || left(why, 200), bk.id);

  perform log_action('admin_cancel_booking','booking',bk.id, jsonb_build_object('reason',why));
  return jsonb_build_object('ok', true, 'msg', 'Cancelled — both sides notified');
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
    'customer','cancelled', '❌ ऑर्डर कैंसल हुआ', '❌ Order cancelled',
    'सब्ज़ीवाला ऑर्डर ' || bk.code || ' पूरा नहीं कर पाया: ' || left(trim(p_reason), 200),
    'The vendor could not fulfil order ' || bk.code || ': ' || left(trim(p_reason), 200), bk.id);
  return jsonb_build_object('ok', true, 'msg',
    tr('Cancel ho gaya, customer ko bata diya','Cancelled, customer notified'));
end $function$;
