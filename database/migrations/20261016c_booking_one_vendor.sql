-- 16 Oct 2026 — a booking only contains items of the vendor it goes to.
-- 11 real orders (Aug–Oct) reached one vendor with another vendor's items and prices, because the
-- basket could mix vendors and customer_create_booking never checked. Now:
--  * no vendor chosen but every item is from one vendor → that vendor is the one asked for;
--  * any item from a different vendor than the booking's → refused with code OTHER_VENDOR
--    (the customer site marks those items in the basket: switch to this vendor's same item or remove).
create or replace function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text default null, p_vendor_id uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  cid uuid; addr addresses; vid uuid; bk bookings;
  it jsonb; prod products; total numeric := 0; oos text; item_vendor uuid; n_vendors int;
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
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    return jsonb_build_object('ok', false, 'msg', tr('Kam se kam ek saman chuno','Pick at least one item'));
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
  values (cid, vid, p_address_id, p_type, p_date, p_slot, p_note)
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
