-- 21 Oct 2026 — live tracking also for orders not dated today.
-- First real test: the vendor marked two orders for TOMORROW "on the way" at 11:20 PM; the vendor app only switched
-- GPS on for today's list and vendor_share_location only counted orders dated today/yesterday, so nothing was ever
-- sent and the customer's map stayed empty. Now any order of this vendor marked on_the_way (yesterday … +14 days)
-- counts, and vendor_live_needed() tells the vendor app on open / every poll whether it must share.

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
   where vendor_id = vid and status = 'on_the_way' and booking_date between ist_date() - 1 and ist_date() + 14;
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
                and b.booking_date between ist_date() - 1 and ist_date() + 14 loop
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


-- vendor app: is any order of mine on the way? (decides whether GPS sharing runs, whatever day the screen shows)
create or replace function public.vendor_live_needed()
 returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('orders',
    (select count(*) from bookings where vendor_id = my_vendor_id() and status = 'on_the_way'
        and booking_date between ist_date() - 1 and ist_date() + 14)));
$function$;
revoke execute on function public.vendor_live_needed() from public, anon;
grant execute on function public.vendor_live_needed() to authenticated;
