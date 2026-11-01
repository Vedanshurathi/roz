-- 16 Oct 2026 — minimum order set by the admin + booking loopholes closed on the server.
--  * app_settings.min_order (default ₹50): min_order(), admin_set_min_order(p_amount), shown in admin_settings();
--    public_app_config() (anon) tells the customer site. Each order (= each vendor) must reach it.
--  * customer_create_booking now also refuses: a slot that already closed for today (same 60-min cut-off as
--    customer_slot_status_for — a stale page could book a slot that had started or ended), dates more than
--    14 days ahead, item qty outside 0 < q ≤ 100, totals below the minimum (only the app checked it), and a
--    7th open order for the same day (stops one account from taking every seat).
--  * vendor_record_payment tells the admins when the payment is under 80% of the bill (commission is
--    worked out from the payment, so an under-reported payment lowers what the vendor owes).
--  * long free text (rating comment, dispute reason, order note) is cut to 500 characters.

create or replace function public.min_order()
 returns numeric language sql stable security definer set search_path to 'public'
as $function$
  select coalesce((select (value #>> '{}')::numeric from app_settings where key = 'min_order'), 50);
$function$;

create or replace function public.admin_set_min_order(p_amount numeric)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare old numeric := min_order();
begin
  perform admin_guard();
  if p_amount is null or p_amount < 0 or p_amount > 5000 then
    return jsonb_build_object('ok', false, 'msg', 'Minimum order ₹0 se ₹5000 ke beech rakho');
  end if;
  insert into app_settings (key, value, updated_at, updated_by) values ('min_order', to_jsonb(round(p_amount)), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform log_action('min_order_changed', 'settings', null, jsonb_build_object('from', old, 'to', round(p_amount)));
  return jsonb_build_object('ok', true, 'msg', 'Minimum order ab ₹' || round(p_amount) || ' hai');
end $function$;

create or replace function public.public_app_config()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('min_order', min_order(), 'otp', customer_otp_on()));
$function$;

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
    'min_order_updated_at', (select updated_at from app_settings where key = 'min_order')));
end $function$;

revoke execute on function public.min_order() from public, anon;
grant execute on function public.min_order() to authenticated;
revoke execute on function public.admin_set_min_order(numeric) from public, anon;
grant execute on function public.admin_set_min_order(numeric) to authenticated;
grant execute on function public.public_app_config() to anon, authenticated;

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

create or replace function public.vendor_record_payment(p_booking uuid, p_method pay_method, p_amount numeric)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if bk.status not in ('bill_approved','bill_final') then
    return jsonb_build_object('ok', false, 'msg',
      tr('Pehle customer se bill approve karwao','Get the bill approved first'));
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi rakam daalo','Enter a valid amount'));
  end if;
  insert into payments (booking_id, method, amount)
  values (p_booking, p_method, p_amount)
  on conflict (booking_id) do update set method=excluded.method, amount=excluded.amount, paid_at=now();
  update bookings set status='paid' where id=p_booking;
  -- commission is worked out from the payment: a payment well under the bill goes to the admins
  if coalesce(bk.final_total, 0) > 0 and p_amount < bk.final_total * 0.8 then
    perform notify_bi(null, 'admin', 'payment_low', bk.code, bk.code,
      'Payment bill se kam: ₹' || round(p_amount) || ' (bill ₹' || round(bk.final_total) || ')',
      'Payment below the bill: ₹' || round(p_amount) || ' (bill ₹' || round(bk.final_total) || ')', bk.id);
  end if;
  return jsonb_build_object('ok', true, 'msg',
    tr('Payment record ho gaya — ab OTP daalo','Payment recorded — now enter the OTP'));
end $function$;

create or replace function public.customer_rate(p_booking uuid, p_stars integer, p_comment text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Booking nahi mili', 'Booking nahi mili')); end if;
  if bk.status <> 'delivered' then
    return jsonb_build_object('ok', false, 'msg', tr('Delivery ke baad hi rating de sakte ho', 'Delivery ke baad hi rating de sakte ho'));
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    return jsonb_build_object('ok', false, 'msg', tr('1 se 5 star chuno', '1 se 5 star chuno'));
  end if;
  insert into ratings (booking_id, vendor_id, stars, comment)
  values (p_booking, bk.vendor_id, p_stars, left(p_comment, 500))
  on conflict (booking_id) do update set stars=excluded.stars, comment=excluded.comment;
  update bookings set status='completed' where id=p_booking;
  return jsonb_build_object('ok', true, 'msg', tr('Shukriya rating ke liye!', 'Shukriya rating ke liye!'));
end $function$;

create or replace function public.customer_dispute_bill(p_booking uuid, p_reason text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk.id is null then return jsonb_build_object('ok', false, 'msg', tr('Booking nahi mili', 'Booking nahi mili')); end if;
  if bk.status not in ('bill_final','bill_approved') then
    return jsonb_build_object('ok', false, 'msg', tr('Bill aane ke baad hi shikayat kar sakte ho','You can only report a problem once the bill is ready'));
  end if;
  update bookings set status='disputed', dispute_reason=left(p_reason, 500) where id=p_booking;
  perform notify_user(null,'admin','dispute',bk.code,
    'Bill pe dispute — ' || coalesce(left(p_reason, 200),''), bk.id);
  return jsonb_build_object('ok', true, 'msg', tr('Hum ise dekh rahe hain, jaldi batayenge', 'Hum ise dekh rahe hain, jaldi batayenge'));
end $function$;
