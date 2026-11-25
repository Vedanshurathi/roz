-- RozBazaar — public schema
-- Supabase project srvpfyjmwaruebbkqkdj (Postgres 17)
-- Generated 2026-09-26 10:21 IST from pg_catalog via the Supabase MCP (see DUMP_FULL_SCHEMA.md, Option B).
-- Schema only: no data. Not a byte-for-byte pg_dump; replace with `supabase db dump` output when the CLI is available.

set check_function_bodies = false;

-- ===== Extensions =====

create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ===== Enums =====

create type public.booking_status as enum ('placed', 'on_the_way', 'reached', 'bill_final', 'bill_approved', 'paid', 'delivered', 'completed', 'cancelled', 'missed', 'disputed', 'pending_review');
create type public.pay_method as enum ('cash', 'upi_direct', 'online');
create type public.product_review_status as enum ('pending', 'approved', 'rejected');
create type public.schedule_mode as enum ('one_time', 'recurring');
create type public.time_slot as enum ('morning', 'afternoon', 'evening');
create type public.vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.vendor_type as enum ('vegetable', 'fruit', 'onion_potato');

-- ===== Functions =====

CREATE OR REPLACE FUNCTION public.admin_add_catalog_item(p_name_en text, p_name_hi text, p_desc_en text, p_desc_hi text, p_category text, p_default_unit text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare new_key text; next_n int; c catalog_items;
begin
  perform admin_guard();
  if length(trim(coalesce(p_name_en,''))) < 1 or length(trim(coalesce(p_name_hi,''))) < 1 then
    return jsonb_build_object('ok', false, 'msg', 'English aur Hindi dono naam chahiye');
  end if;
  if p_category not in ('vegetable','fruit','onion_potato') then
    return jsonb_build_object('ok', false, 'msg', 'Category sahi nahi hai');
  end if;
  select coalesce(max(substring(key from 2)::int), 27) + 1 into next_n
    from catalog_items where key ~ '^p[0-9]+$';
  new_key := 'p' || next_n;
  insert into catalog_items (key, name_en, name_hi, desc_en, desc_hi, category, default_unit, art_key, sort_order)
  values (new_key, trim(p_name_en), trim(p_name_hi), coalesce(trim(p_desc_en),''), coalesce(trim(p_desc_hi),''),
          p_category, coalesce(trim(p_default_unit),'1 kg'), new_key, next_n)
  returning * into c;
  return jsonb_build_object('ok', true, 'data', to_jsonb(c));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_add_vendor(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text DEFAULT NULL::text, p_vehicle text DEFAULT NULL::text, p_capacity integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v vendors;
begin
  perform admin_guard();
  if exists (select 1 from vendors where phone = p_phone) then
    return jsonb_build_object('ok', false, 'msg', 'Ye phone pehle se juda hai');
  end if;

  insert into vendors (name,phone,shop_name,v_type,vehicle,areas_served,default_capacity,
                       status,reviewed_at,reviewed_by,is_active)
  values (p_name,p_phone,p_shop,p_type,p_vehicle,p_areas,coalesce(p_capacity,15),
          'approved',now(),auth.uid(),true)
  returning * into v;

  perform log_action('vendor_added','vendor',v.id,null);
  return jsonb_build_object('ok', true, 'msg', p_name || ' jud gaya aur live hai',
    'data', to_jsonb(v));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_areas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(a) order by a.name), '[]'::jsonb) into res
    from (select a.*,
                 (select count(*) from vendors v
                   where a.name = any(v.areas_served) and v.status='approved') as vendor_count
            from areas a) a;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_block_customer(p_customer uuid, p_blocked boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform admin_guard();
  update customers set is_blocked = p_blocked where id = p_customer;
  perform log_action('customer_block','customer',p_customer,jsonb_build_object('blocked',p_blocked));
  return jsonb_build_object('ok', true,
    'msg', case when p_blocked then 'Customer block ho gaya' else 'Unblock ho gaya' end);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_bookings(p_date date DEFAULT NULL::date, p_status booking_status DEFAULT NULL::booking_status, p_area text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(b) order by b.booking_date desc, b.slot), '[]'::jsonb)
    into res from (
      select * from booking_full
       where (p_date   is null or booking_date = p_date)
         and (p_status is null or status = p_status)
         and (p_area   is null or area = p_area)
       order by booking_date desc, slot limit p_limit
    ) b;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare bk bookings;
begin
  perform admin_guard();
  if coalesce(trim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'msg', 'A reason is required');
  end if;
  select * into bk from bookings where id = p_booking;
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking not found'); end if;
  if bk.status in ('completed','delivered','cancelled') then
    return jsonb_build_object('ok', false, 'msg',
      'Already ' || bk.status || ' — cannot cancel a booking that''s already finished');
  end if;

  update bookings set status='cancelled', cancel_reason='Admin: '||p_reason where id=p_booking;

  perform notify_bi((select auth_user_id from customers where id=bk.customer_id),
    'customer','cancelled', bk.code, bk.code,
    'RozBazaar ne ye order cancel kiya: '||p_reason,
    'RozBazaar cancelled this order: '||p_reason, bk.id);
  perform notify_bi((select auth_user_id from vendors where id=bk.vendor_id),
    'vendor','cancelled', bk.code, bk.code,
    'RozBazaar ne ye order cancel kiya: '||p_reason,
    'RozBazaar cancelled this order: '||p_reason, bk.id);

  perform log_action('admin_cancel_booking','booking',bk.id, jsonb_build_object('reason',p_reason));
  return jsonb_build_object('ok', true, 'msg', 'Cancelled — both sides notified');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_capacity_watch(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.fill_pct desc), '[]'::jsonb) into res
  from (
    select v.name as vendor, v.v_type, vs.slot_date, vs.slot,
           vs.booked_count, vs.capacity,
           round(vs.booked_count::numeric / nullif(vs.capacity,0) * 100) as fill_pct
      from vendor_slots vs join vendors v on v.id = vs.vendor_id
     where vs.slot_date between current_date and current_date + p_days
       and vs.booked_count > 0
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_catalog_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) into res
    from catalog_items c;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_customers(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.bookings desc), '[]'::jsonb) into res
  from (
    select c.id,c.name,c.phone,c.email,c.is_blocked,c.created_at,
           (select count(*) from bookings b where b.customer_id=c.id) as bookings,
           (select max(booking_date) from bookings b where b.customer_id=c.id) as last_order,
           (select area from addresses a where a.customer_id=c.id and a.is_default limit 1) as area
      from customers c limit p_limit
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_daily_report(p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.d), '[]'::jsonb) into res
  from (
    select d::date as d,
      (select count(*) from bookings where booking_date=d::date)                       as total,
      (select count(*) from bookings where booking_date=d::date and status='completed')as completed,
      (select count(*) from bookings where booking_date=d::date and status='cancelled')as cancelled,
      (select count(*) from bookings where booking_date=d::date and status='missed')   as missed,
      (select coalesce(sum(p.amount),0) from payments p join bookings b on b.id=p.booking_id
         where b.booking_date=d::date)                                                 as sales
    from generate_series(current_date - p_days, current_date, interval '1 day') d
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_demand_gaps()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requests desc), '[]'::jsonb) into res
  from (
    select w.area, w.v_type, count(*) as requests,
           max(w.created_at) as latest,
           (select count(*) from vendors v
             where v.status='approved' and v.v_type=w.v_type
               and w.area = any(v.areas_served)) as vendors_there
      from waitlist w
     where w.notified = false
     group by w.area, w.v_type
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_finance_dashboard(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
  gmv_today numeric; gmv_yesterday numeric; gmv_week numeric; gmv_prev_week numeric;
  gmv_month numeric; gmv_all numeric;
  orders_today int; orders_completed_period int; orders_total_period int;
  aov numeric; cash_total numeric; upi_total numeric;
  trend jsonb; top_vendors jsonb; active_vendors int; active_customers_period int;
begin
  perform admin_guard();

  select coalesce(sum(p.amount),0) into gmv_today
    from payments p join bookings b on b.id=p.booking_id where b.booking_date=current_date;
  select coalesce(sum(p.amount),0) into gmv_yesterday
    from payments p join bookings b on b.id=p.booking_id where b.booking_date=current_date-1;
  select coalesce(sum(p.amount),0) into gmv_week
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date-6;
  select coalesce(sum(p.amount),0) into gmv_prev_week
    from payments p join bookings b on b.id=p.booking_id
    where b.booking_date >= current_date-13 and b.booking_date <= current_date-7;
  select coalesce(sum(p.amount),0) into gmv_month
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date-29;
  select coalesce(sum(amount),0) into gmv_all from payments;

  select count(*) into orders_today from bookings where booking_date=current_date;
  select count(*) filter (where status='completed'), count(*) into orders_completed_period, orders_total_period
    from bookings where booking_date >= current_date - p_days;

  select case when count(*)=0 then 0 else round(avg(amount),0) end into aov
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date - p_days;

  -- real enum values are cash / upi_direct / online — grouping the
  -- latter two together as "digital" for a clean two-way split
  select coalesce(sum(amount) filter (where method='cash'),0),
         coalesce(sum(amount) filter (where method in ('upi_direct','online')),0)
    into cash_total, upi_total
    from payments p join bookings b on b.id=p.booking_id where b.booking_date >= current_date - p_days;

  select count(distinct vendor_id) into active_vendors
    from bookings where booking_date >= current_date - p_days and status='completed';
  select count(distinct customer_id) into active_customers_period
    from bookings where booking_date >= current_date - p_days and status='completed';

  select coalesce(jsonb_agg(jsonb_build_object(
           'd', d, 'gmv', gmv, 'orders', orders) order by d), '[]'::jsonb)
    into trend
    from (
      select gs::date as d,
        (select coalesce(sum(p.amount),0) from payments p join bookings b on b.id=p.booking_id
          where b.booking_date=gs::date) as gmv,
        (select count(*) from bookings where booking_date=gs::date and status='completed') as orders
      from generate_series(current_date - (p_days-1), current_date, interval '1 day') gs
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', v.name, 'gmv', vg.gmv, 'orders', vg.orders) order by vg.gmv desc), '[]'::jsonb)
    into top_vendors
    from (
      select b.vendor_id, sum(p.amount) as gmv, count(distinct b.id) as orders
        from payments p join bookings b on b.id=p.booking_id
       where b.booking_date >= current_date - p_days
       group by b.vendor_id
       order by sum(p.amount) desc limit 5
    ) vg
    join vendors v on v.id = vg.vendor_id;

  res := jsonb_build_object(
    'gmv_today', gmv_today, 'gmv_yesterday', gmv_yesterday,
    'gmv_week', gmv_week, 'gmv_prev_week', gmv_prev_week,
    'gmv_month', gmv_month, 'gmv_all', gmv_all,
    'orders_today', orders_today,
    'orders_completed_period', orders_completed_period, 'orders_total_period', orders_total_period,
    'aov', aov, 'cash_total', cash_total, 'upi_total', upi_total,
    'active_vendors', active_vendors, 'active_customers_period', active_customers_period,
    'platform_revenue', 0, 'commission_rate', 0,
    'trend', trend, 'top_vendors', top_vendors, 'period_days', p_days
  );
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_guard()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then raise exception 'Sirf admin ye kar sakta hai'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_link_vendor_login(p_vendor uuid, p_auth uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform admin_guard();
  update vendors set auth_user_id = p_auth where id = p_vendor;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Login jod diya');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_message_read(p_message uuid, p_read boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform admin_guard();
  update messages set is_read = p_read where id = p_message;
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_messages(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb)
    into res from (select * from messages order by created_at desc limit p_limit) m;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_overview_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select to_jsonb(o) into res from admin_overview o;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_pending_products()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform admin_guard();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'unit', p.unit, 'price', p.price, 'category', p.category,
      'image_url', p.image_url, 'created_at', p.created_at,
      'vendor_id', v.id, 'vendor_name', v.name, 'vendor_phone', v.phone
    ) order by p.created_at)
    from products p join vendors v on v.id=p.vendor_id
    where p.review_status='pending'), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_products()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'unit', p.unit, 'price', p.price,
           'in_stock', p.in_stock, 'category', p.category,
           'review_status', p.review_status, 'image_url', p.image_url,
           'price_updated_at', p.price_updated_at,
           'vendor_id', p.vendor_id, 'vendor_name', v.name
         ) order by v.name, p.category, p.name), '[]'::jsonb)
    into res
    from products p join vendors v on v.id = p.vendor_id;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reassign_booking(p_booking uuid, p_vendor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings; old_v uuid;
begin
  perform admin_guard();
  select * into bk from bookings where id = p_booking;
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  if not exists (select 1 from live_vendors where id = p_vendor) then
    return jsonb_build_object('ok', false, 'msg', 'Vendor live nahi hai');
  end if;

  old_v := bk.vendor_id;
  update bookings set vendor_id = p_vendor where id = p_booking;

  if old_v is not null then
    update vendor_slots set booked_count = greatest(0, booked_count - 1)
     where vendor_id = old_v and slot_date = bk.booking_date and slot = bk.slot;
  end if;
  insert into vendor_slots (vendor_id,slot_date,slot,capacity,booked_count)
  values (p_vendor,bk.booking_date,bk.slot,
          coalesce((select default_capacity from vendors where id=p_vendor),15),1)
  on conflict (vendor_id,slot_date,slot) do update set booked_count = vendor_slots.booked_count + 1;

  perform notify_user((select auth_user_id from vendors where id=p_vendor),
    'vendor','reassigned',bk.code,'Aapko ek order assign hua hai',bk.id);
  perform log_action('booking_reassigned','booking',p_booking,
    jsonb_build_object('from',old_v,'to',p_vendor));
  return jsonb_build_object('ok', true, 'msg', 'Dusre vendor ko de diya');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_recompute_area_coords(p_min_samples integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; changed jsonb := '[]'::jsonb; n int;
begin
  perform admin_guard();
  for r in
    select a.area, count(*) as pins,
           avg(a.lat) as lat, avg(a.lng) as lng,
           max(km_between(avg(a.lat) over (partition by a.area),
                          avg(a.lng) over (partition by a.area), a.lat, a.lng)) as spread
    from addresses a
    where a.lat is not null and a.lng is not null
    group by a.area
    having count(*) >= p_min_samples
  loop
    update areas
       set lat = r.lat, lng = r.lng, coords_verified = true,
           radius_km = greatest(2, least(8, ceil(coalesce(r.spread,3))))
     where name = r.area;
    changed = changed || jsonb_build_object('area',r.area,'pins',r.pins,
                'lat',round(r.lat::numeric,5),'lng',round(r.lng::numeric,5));
  end loop;
  return jsonb_build_object('ok',true,'data',changed,
    'msg', tr('Area centre update ho gaya','Area centres updated'));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_remove_catalog_item(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform admin_guard();
  update catalog_items set is_active = false where key = p_key;
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_resolve(p_booking uuid, p_status booking_status, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  perform admin_guard();
  select * into bk from bookings where id = p_booking;
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;

  -- admin may force-complete an OTP-stuck order, and this is the ONLY
  -- place that can bypass the OTP gate — it is logged every time.
  if p_status = 'delivered' then
    update bookings set status='delivered', otp_verified_at=now(),
           admin_note = coalesce(p_note,'Admin ne manually complete kiya')
     where id = p_booking;
  else
    update bookings set status = p_status, admin_note = p_note where id = p_booking;
  end if;

  perform log_action('admin_resolve','booking',p_booking,
    jsonb_build_object('status',p_status,'note',p_note));
  return jsonb_build_object('ok', true, 'msg', 'Update ho gaya');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_review_product(p_product uuid, p_decision product_review_status, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p products;
begin
  perform admin_guard();
  if p_decision not in ('approved','rejected') then
    return jsonb_build_object('ok',false,'msg','Sirf approve ya reject bhej sakte ho');
  end if;
  update products set review_status=p_decision, reviewed_by=auth.uid(), reviewed_at=now(), review_note=p_note
   where id=p_product returning * into p;
  if p is null then return jsonb_build_object('ok',false,'msg','Product nahi mila'); end if;
  return jsonb_build_object('ok',true,'msg',
    case when p_decision='approved' then tr('मंज़ूर हो गया','Approved') else tr('रिजेक्ट हो गया','Rejected') end,
    'data', to_jsonb(p));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_review_vendor(p_vendor uuid, p_decision vendor_status, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v vendors;
begin
  perform admin_guard();
  if p_decision not in ('approved','rejected','suspended') then
    return jsonb_build_object('ok', false, 'msg', 'Invalid decision');
  end if;

  update vendors
     set status=p_decision, reviewed_at=now(), reviewed_by=auth.uid(),
         review_note=p_note, is_active=(p_decision='approved')
   where id = p_vendor returning * into v;

  if v is null then return jsonb_build_object('ok', false, 'msg', 'Vendor not found'); end if;

  if p_decision <> 'approved' then
    update bookings set status='cancelled', cancel_reason='Vendor ab active nahi hai'
     where vendor_id=p_vendor and booking_date >= current_date
       and status in ('placed','on_the_way');
  end if;

  if v.auth_user_id is not null then
    perform notify_bi(v.auth_user_id,'vendor','vendor_review',
      case when p_decision='approved' then 'Approve ho gaya!' else 'Application update' end,
      case when p_decision='approved' then 'Approved!' else 'Application update' end,
      case when p_decision='approved'
           then 'Badhai ho! Ab customer aapko app me dekh sakte hain.'
           else 'Aapka application abhi approve nahi hua. ' || coalesce(p_note,'') end,
      case when p_decision='approved'
           then 'Congratulations! Customers can now see you in the app.'
           else 'Your application was not approved. ' || coalesce(p_note,'') end, null);
  end if;

  perform log_action('vendor_'||p_decision,'vendor',p_vendor,jsonb_build_object('note',p_note));
  return jsonb_build_object('ok', true,
    'msg', case p_decision
      when 'approved' then v.name || ' is now live'
      when 'rejected' then v.name || ' rejected'
      else v.name || ' suspended' end,
    'data', to_jsonb(v));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_area_point(p_name text, p_lat double precision, p_lng double precision, p_radius numeric DEFAULT 4, p_verified boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform admin_guard();
  update areas set lat=p_lat, lng=p_lng, radius_km=p_radius, coords_verified=p_verified
   where name=p_name;
  if not found then return jsonb_build_object('ok',false,'msg','Area nahi mila'); end if;
  return jsonb_build_object('ok',true,'msg',tr('Area point set ho gaya','Area point saved'));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_product(p_product uuid, p_price numeric DEFAULT NULL::numeric, p_in_stock boolean DEFAULT NULL::boolean, p_name text DEFAULT NULL::text, p_name_hi text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p products;
begin
  perform admin_guard();
  if p_price is not null and p_price <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'Price 0 se zyada honi chahiye');
  end if;
  if p_category is not null and p_category not in ('vegetable','fruit','onion_potato') then
    return jsonb_build_object('ok', false, 'msg', 'Category vegetable, fruit, ya onion_potato hona chahiye');
  end if;
  update products set
    price = coalesce(p_price, price),
    price_updated_at = case when p_price is not null then now() else price_updated_at end,
    in_stock = coalesce(p_in_stock, in_stock),
    name = coalesce(nullif(trim(p_name),''), name),
    name_hi = coalesce(nullif(trim(p_name_hi),''), name_hi),
    category = coalesce(p_category::vendor_type, category),
    unit = coalesce(nullif(trim(p_unit),''), unit)
   where id = p_product returning * into p;
  if p is null then return jsonb_build_object('ok', false, 'msg', 'Product nahi mila'); end if;
  perform log_action('admin_update_product','product',p.id,
    jsonb_build_object('name',p_name,'category',p_category,'price',p_price));
  return jsonb_build_object('ok', true, 'data', to_jsonb(p));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_area(p_name text, p_active boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform admin_guard();
  insert into areas (name, is_active) values (p_name, p_active)
  on conflict (name) do update set is_active = excluded.is_active;
  return jsonb_build_object('ok', true, 'msg', 'Area save ho gaya');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_vendor_performance(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.completed desc), '[]'::jsonb) into res
  from (
    select v.id, v.name, v.v_type, v.areas_served, v.avg_rating, v.total_ratings,
      count(b.id) filter (where b.status='completed')                as completed,
      count(b.id) filter (where b.status='cancelled')                as cancelled,
      count(b.id) filter (where b.status='missed')                   as missed,
      count(b.id) filter (where b.status in ('disputed','pending_review')) as flagged,
      coalesce(sum(p.amount),0)                                      as sales,
      (select count(*) from products pr where pr.vendor_id=v.id and pr.in_stock
         and now()-pr.price_updated_at > interval '24 hours')        as stale_prices
      from vendors v
      left join bookings b on b.vendor_id=v.id and b.booking_date >= current_date - p_days
      left join payments p on p.booking_id=b.id
     where v.status='approved'
     group by v.id
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_vendors(p_status vendor_status DEFAULT NULL::vendor_status)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(v) order by
           case v.status when 'pending' then 1 when 'approved' then 2 else 3 end,
           v.applied_at desc), '[]'::jsonb)
    into res from (
      select v.*,
             (select count(*) from products p where p.vendor_id=v.id) as product_count,
             (select count(*) from bookings b where b.vendor_id=v.id
                and b.booking_date=current_date and b.status<>'cancelled') as today_orders
        from vendors v
       where p_status is null or v.status = p_status
    ) v;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_visit_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare daily jsonb; totals jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(jsonb_build_object(
      'd', d::text,
      'customer', coalesce((select count(*) from site_visits where visited_on=d and page='customer'),0),
      'vendor',   coalesce((select count(*) from site_visits where visited_on=d and page='vendor'),0)
    ) order by d), '[]'::jsonb)
  into daily
  from generate_series(ist_date() - (p_days-1), ist_date(), interval '1 day') d;

  select jsonb_build_object(
    'total', (select count(*) from site_visits where visited_on >= ist_date()-(p_days-1)),
    'customer', (select count(*) from site_visits where visited_on >= ist_date()-(p_days-1) and page='customer'),
    'vendor', (select count(*) from site_visits where visited_on >= ist_date()-(p_days-1) and page='vendor'),
    'today', (select count(*) from site_visits where visited_on = ist_date())
  ) into totals;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('daily', daily, 'totals', totals));
end $function$
;

CREATE OR REPLACE FUNCTION public.area_from_point(p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare best record; second record; res jsonb; confident boolean;
begin
  select a.name, a.radius_km, a.coords_verified,
         km_between(p_lat,p_lng,a.lat,a.lng) as dist,
         exists (select 1 from vendors v where v.status='approved' and v.is_active
                   and a.name = any(v.areas_served)) as served
    into best
  from areas a where a.is_active and a.lat is not null
  order by km_between(p_lat,p_lng,a.lat,a.lng) asc limit 1;

  if best is null then
    return jsonb_build_object('ok',true,'data',jsonb_build_object('in_range',false,'confident',false));
  end if;

  select a.name, km_between(p_lat,p_lng,a.lat,a.lng) as dist into second
  from areas a where a.is_active and a.lat is not null and a.name <> best.name
  order by km_between(p_lat,p_lng,a.lat,a.lng) asc limit 1;

  -- confident only when the pin is verified, comfortably inside the radius,
  -- and clearly nearer than the runner-up
  confident := best.coords_verified
               and best.dist <= best.radius_km * 0.75
               and (second is null or second.dist - best.dist >= 1.5);

  select coalesce(jsonb_agg(jsonb_build_object(
           'area', x.name, 'distance', round(x.dist::numeric,2), 'served', x.served)
         order by x.dist), '[]'::jsonb) into res
  from (
    select a.name, km_between(p_lat,p_lng,a.lat,a.lng) as dist,
           exists (select 1 from vendors v where v.status='approved' and v.is_active
                     and a.name = any(v.areas_served)) as served
    from areas a where a.is_active and a.lat is not null
    order by km_between(p_lat,p_lng,a.lat,a.lng) limit 3
  ) x;

  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'area',        best.name,
    'distance',    round(best.dist::numeric,2),
    'in_range',    best.dist <= best.radius_km,
    'served',      best.served,
    'verified',    best.coords_verified,
    'confident',   confident,
    'alternatives',res));
end $function$
;

CREATE OR REPLACE FUNCTION public.catalog_items_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object('ok', true, 'data',
    coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb))
  from catalog_items c where c.is_active;
$function$
;

CREATE OR REPLACE FUNCTION public.customer_approve_bill(p_booking uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  if bk.status <> 'bill_final' then
    return jsonb_build_object('ok', false, 'msg', 'Bill abhi final nahi hua');
  end if;

  update bookings set status='bill_approved', bill_approved_at=now() where id=p_booking;
  perform notify_user((select auth_user_id from vendors where id=bk.vendor_id),
    'vendor','bill_approved',bk.code,'Customer ne bill approve kar diya',bk.id);
  return jsonb_build_object('ok', true, 'msg', 'Bill approve ho gaya — ab payment karo');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_available_types(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(t), '[]'::jsonb) into res from (
    select v_type,
           count(*)          as vendor_count,
           round(avg(avg_rating),1) as avg_rating
      from live_vendors
     where p_area = any(areas_served)
     group by v_type
  ) t;
  return jsonb_build_object('ok', true, 'data', res,
    'msg', case when res = '[]'::jsonb
      then 'Is area me abhi koi vendor nahi hai' else 'ok' end);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'name', v.name, 'photo_url', v.photo_url,
           'avg_rating', coalesce(v.avg_rating, 0),
           'total_ratings', coalesce(v.total_ratings, 0),
           'booked', coalesce(vs.booked_count, 0),
           'capacity', coalesce(vs.capacity, v.default_capacity)
         ) order by coalesce(v.avg_rating,0) desc, coalesce(vs.booked_count,0) asc), '[]'::jsonb)
    into res
    from vendors v
    left join vendor_slots vs
      on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = p_slot::time_slot
   where v.status = 'approved' and v.is_active
     and v.v_type = p_type
     and vendor_covers_area_in_slot(v.id, p_area, p_slot::time_slot)
     and coalesce(vs.is_open, true)
     and coalesce(vs.booked_count, 0) < coalesce(vs.capacity, v.default_capacity);
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_bill_preview(p_booking uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings; diff jsonb; new_total numeric;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;

  select coalesce(jsonb_agg(to_jsonb(d) order by
           case d.change_kind when 'added' then 1 when 'changed' then 2
                              when 'removed' then 3 else 4 end), '[]'::jsonb),
         sum(case when d.removed then 0 else d.final_qty * d.final_price end)
    into diff, new_total
    from bill_diff d where d.booking_id = p_booking;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'code', bk.code, 'status', bk.status,
    'est_total', bk.est_total, 'final_total', coalesce(bk.final_total, new_total),
    'changes', diff));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_bootstrap(p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_provider text DEFAULT 'google'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c customers;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'msg', 'Pehle login karo');
  end if;

  insert into customers (auth_user_id, name, phone, email, auth_provider)
  values (auth.uid(), p_name, p_phone, p_email, p_provider)
  on conflict (auth_user_id) do update
    set name  = coalesce(excluded.name,  customers.name),
        phone = coalesce(excluded.phone, customers.phone),
        email = coalesce(excluded.email, customers.email)
  returning * into c;

  return jsonb_build_object('ok', true, 'data', to_jsonb(c),
    'msg', case when c.phone is null then 'Phone number daalna baaki hai' else 'Ready' end);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_cancel_booking(p_booking uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  if bk.status not in ('placed','on_the_way') then
    return jsonb_build_object('ok', false, 'msg', 'Vendor pahunch chuka hai, ab cancel nahi hoga');
  end if;
  update bookings set status='cancelled', cancel_reason=coalesce(p_reason,'Customer ne cancel kiya')
   where id=p_booking;
  perform notify_user((select auth_user_id from vendors where id=bk.vendor_id),
    'vendor','cancelled',bk.code,'Customer ne order cancel kar diya',bk.id);
  return jsonb_build_object('ok', true, 'msg', 'Order cancel ho gaya');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_catalogue(p_type vendor_type, p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.name), '[]'::jsonb) into res
  from (
    select distinct on (lower(p.name))
           p.id, p.name, p.image_url, p.unit, p.price, p.category,
           p.price_is_stale, p.sort_order, p.vendor_id, p.vendor_name
      from live_products p
     where p.category = p_type
       and p_area = any(p.areas_served)
     order by lower(p.name), p.price asc
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text DEFAULT NULL::text, p_vendor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  cid uuid; addr addresses; vid uuid; bk bookings;
  it jsonb; prod products; total numeric := 0;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in')); end if;
  if exists (select 1 from customers where id = cid and is_blocked) then
    return jsonb_build_object('ok', false, 'msg', tr('Aapka account block hai','Your account is blocked'));
  end if;

  select * into addr from addresses where id = p_address_id and customer_id = cid;
  if addr is null then return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found')); end if;

  if p_date < ist_date() then
    return jsonb_build_object('ok', false, 'msg', tr('Purani date nahi chun sakte','Cannot pick a past date'));
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    return jsonb_build_object('ok', false, 'msg', tr('Kam se kam ek saman chuno','Pick at least one item'));
  end if;

  if p_vendor_id is not null then
    select v.id into vid
      from vendors v
      left join vendor_slots vs on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = p_slot
     where v.id = p_vendor_id
       and v.status = 'approved' and v.is_active and v.v_type = p_type
       and addr.area = any(v.areas_served)
       and coalesce(vs.is_open, true)
       and coalesce(vs.booked_count, 0) < coalesce(vs.capacity, v.default_capacity);
  end if;
  if vid is null then
    vid := match_vendor(p_type, addr.area, p_date, p_slot);
  end if;
  if vid is null then
    return jsonb_build_object('ok', false, 'code', 'NO_VENDOR',
      'msg', tr('Is slot me koi vendor free nahi hai. Dusra slot ya din chuno.',
                'No vendor is free in this slot. Please pick another slot or day.'));
  end if;

  insert into bookings (customer_id, vendor_id, address_id, v_type, booking_date, slot, note)
  values (cid, vid, p_address_id, p_type, p_date, p_slot, p_note)
  returning * into bk;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from products where id = (it->>'product_id')::uuid;
    if prod is null then continue; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_create_schedule(p_type vendor_type, p_address_id uuid, p_weekdays integer[], p_slot time_slot, p_start date, p_end date, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; s booking_schedules; made int;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', 'Pehle login karo'); end if;
  if array_length(p_weekdays,1) is null then
    return jsonb_build_object('ok', false, 'msg', 'Kam se kam ek din chuno');
  end if;

  insert into booking_schedules
    (customer_id,address_id,v_type,mode,weekdays,slot,start_date,end_date,template)
  values (cid,p_address_id,p_type,'recurring',p_weekdays,p_slot,
          greatest(p_start,current_date), p_end, p_items)
  returning * into s;

  select spawned into made from spawn_schedule_bookings(s.id, 21);

  return jsonb_build_object('ok', true,
    'msg', made || ' booking bana di gayi',
    'data', jsonb_build_object('schedule_id', s.id, 'spawned', made));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_delete_address(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from addresses where id = p_id and customer_id = my_customer_id();
  if not found then return jsonb_build_object('ok', false, 'msg', 'Address nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Address hata diya');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_dispute_bill(p_booking uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  update bookings set status='disputed', dispute_reason=p_reason where id=p_booking;
  perform notify_user(null,'admin','dispute',bk.code,
    'Bill pe dispute — ' || coalesce(p_reason,''), bk.id);
  return jsonb_build_object('ok', true, 'msg', 'Hum ise dekh rahe hain, jaldi batayenge');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_home(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid := my_customer_id(); types jsonb; items jsonb; favs jsonb; ars jsonb;
begin
  select coalesce(jsonb_agg(t), '[]'::jsonb) into types from (
    select v.v_type,
           count(*)::int                        as vendor_count,
           round(avg(nullif(v.avg_rating,0)),1) as avg_rating,
           min(v.name)                          as sample_vendor
      from vendors v
     where v.status='approved' and v.is_active and p_area = any(v.areas_served)
     group by v.v_type
  ) t;

  -- vendor_rating now travels with each product too — the customer
  -- couldn't see who they were buying from or how that vendor rates
  -- while just scrolling a category, only after opening a separate
  -- vendor picker most people never found.
  select coalesce(jsonb_agg(x order by (x->>'in_stock')::boolean desc, x->>'category', (x->>'sort_order')::int), '[]'::jsonb) into items
  from (
    select (to_jsonb(p) - 'review_status' - 'reviewed_by' - 'reviewed_at' - 'review_note')
           || jsonb_build_object('vendor_name', v.name, 'vendor_rating', coalesce(v.avg_rating,0)) as x
    from products p join vendors v on v.id = p.vendor_id
    where v.status='approved' and v.is_active
      and p.review_status = 'approved'
      and p_area = any(v.areas_served)
  ) s;

  select coalesce(jsonb_agg(f.product_id), '[]'::jsonb) into favs
  from favourites f where cid is not null and f.customer_id = cid;

  select coalesce(jsonb_agg(a.name order by a.name), '[]'::jsonb) into ars
  from areas a where a.is_active;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'area', p_area, 'types', types, 'products', items, 'favourites', favs,
    'areas', ars, 'served', jsonb_array_length(types) > 0));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into waitlist (customer_id, area, v_type, phone)
  values (my_customer_id(), p_area, p_type,
          coalesce(p_phone, (select phone from customers where id = my_customer_id())));
  perform notify_user(null,'admin','waitlist', p_area,
    p_area || ' me ' || p_type || ' vendor ki demand hai', null);
  return jsonb_build_object('ok', true, 'msg', 'Jab vendor aayega hum aapko batayenge');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_last_order()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', bi.product_id, 'name', bi.product_name,
           'unit', bi.unit, 'image_url', bi.image_url,
           'qty', coalesce(bi.final_qty, bi.qty))), '[]'::jsonb)
    into res
    from booking_items bi
   where bi.booking_id = (
     select id from bookings
      where customer_id = my_customer_id() and status in ('delivered','completed')
      order by booking_date desc limit 1);
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_my_addresses()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid := my_customer_id();
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(to_jsonb(a) order by a.is_default desc, a.created_at desc)
    from addresses a where a.customer_id = cid), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_my_bookings(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(b) order by b.booking_date desc, b.created_at desc), '[]'::jsonb)
    into res from (
      select * from booking_full
       where customer_id = my_customer_id()
       order by booking_date desc, created_at desc limit p_limit
    ) b;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_phone_login(p_name text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c customers; existing_own customers; clean_phone text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'msg', 'Session nahi mila — dubara try karo');
  end if;
  clean_phone := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if length(clean_phone) <> 10 then
    return jsonb_build_object('ok', false, 'msg', 'Sahi 10-digit number daalo');
  end if;
  if length(trim(coalesce(p_name,''))) < 1 then
    return jsonb_build_object('ok', false, 'msg', 'Naam daalo');
  end if;

  select * into c from customers where phone = clean_phone;
  select * into existing_own from customers where auth_user_id = auth.uid();

  if existing_own.id is not null then
    -- this session already IS somebody (Google before, or phone before
    -- with a different number) — auth_user_id is required and unique,
    -- so it can never move to a different row. The number they just
    -- typed becomes theirs; if it belonged to a different, older row,
    -- that row simply loses it rather than the login silently failing.
    if c.id is not null and c.id <> existing_own.id then
      update customers set phone = null where id = c.id;
    end if;
    update customers set phone = clean_phone, name = trim(p_name)
     where id = existing_own.id returning * into c;
  elsif c.id is not null then
    -- brand-new session (e.g. just went anonymous), and this exact
    -- phone already belongs to someone — that IS the account "log in
    -- with this phone" means, so take it over rather than create a
    -- second, disconnected record for the same real person.
    update customers set auth_user_id = auth.uid(), name = trim(p_name)
     where id = c.id returning * into c;
  else
    insert into customers (auth_user_id, name, phone, auth_provider)
    values (auth.uid(), trim(p_name), clean_phone, 'phone')
    returning * into c;
  end if;

  return jsonb_build_object('ok', true, 'data', to_jsonb(c));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_rate(p_booking uuid, p_stars integer, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and customer_id=my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  if bk.status <> 'delivered' then
    return jsonb_build_object('ok', false, 'msg', 'Delivery ke baad hi rating de sakte ho');
  end if;
  if p_stars < 1 or p_stars > 5 then
    return jsonb_build_object('ok', false, 'msg', '1 se 5 star chuno');
  end if;

  insert into ratings (booking_id, vendor_id, stars, comment)
  values (p_booking, bk.vendor_id, p_stars, p_comment)
  on conflict (booking_id) do update set stars=excluded.stars, comment=excluded.comment;

  update bookings set status='completed' where id=p_booking;
  return jsonb_build_object('ok', true, 'msg', 'Shukriya rating ke liye!');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_make_default boolean DEFAULT true, p_address_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; a addresses;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', 'Pehle login karo'); end if;
  if coalesce(trim(p_area),'') = '' then
    return jsonb_build_object('ok', false, 'msg', 'Area chuno');
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
    if a is null then return jsonb_build_object('ok', false, 'msg', 'Address nahi mila'); end if;
  end if;

  if p_make_default then
    update addresses set is_default = (id = a.id) where customer_id = cid;
  end if;

  return jsonb_build_object('ok', true, 'msg', 'Address save ho gaya', 'data', to_jsonb(a));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_send_message(p_name text, p_body text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare mid uuid;
begin
  if length(trim(coalesce(p_name,''))) < 1 then
    return jsonb_build_object('ok', false, 'msg', 'Naam likhiye');
  end if;
  if length(trim(coalesce(p_body,''))) < 3 then
    return jsonb_build_object('ok', false, 'msg', 'Message thoda lamba likhiye');
  end if;
  insert into messages (name, body, phone, email, customer_id)
  values (trim(p_name), trim(p_body), nullif(trim(coalesce(p_phone,'')),''),
          nullif(trim(coalesce(p_email,'')),''), my_customer_id())
  returning id into mid;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', mid));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_set_pin(p_address uuid, p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update addresses set lat = p_lat, lng = p_lng
   where id = p_address and customer_id = my_customer_id();
  if not found then
    return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found'));
  end if;
  return jsonb_build_object('ok', true, 'msg', tr('Location save ho gayi','Location saved'));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_skip_booking(p_booking uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings
   where id = p_booking and customer_id = my_customer_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', 'Booking nahi mili'); end if;
  if bk.status not in ('placed','on_the_way') then
    return jsonb_build_object('ok', false, 'msg', 'Ab cancel nahi ho sakta');
  end if;
  update bookings set status='cancelled', cancel_reason='Customer ne skip kiya'
   where id = p_booking;
  return jsonb_build_object('ok', true, 'msg', 'Is din ka order cancel — baaki din chalu rahenge');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_slot_status(p_type vendor_type, p_area text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb; lead_minutes int := 60;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot', s.slot,
           'free', s.free,
           'is_past', s.is_past,
           'starts', s.starts,
           'ends',   s.ends,
           'has_room', (s.has_room and not s.is_past)
         ) order by s.starts), '[]'::jsonb)
    into res
  from (
    select sl.slot,
           w.starts, w.ends,
           bool_or(coalesce(vs.booked_count,0) < coalesce(vs.capacity, v.default_capacity)
                   and coalesce(vs.is_open,true)) as has_room,
           sum(greatest(0, coalesce(vs.capacity, v.default_capacity)
                           - coalesce(vs.booked_count,0))) as free,
           (p_date < ist_date())
           or (p_date = ist_date()
               and (ist_now()::time) > (w.starts - make_interval(mins => lead_minutes)))
             as is_past
      from (select unnest(enum_range(null::time_slot)) as slot) sl
      cross join lateral slot_window(sl.slot) w
      cross join vendors v
      left join vendor_slots vs
        on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = sl.slot
     where v.status='approved' and v.is_active
       and v.v_type = p_type
       -- was: p_area = any(v.areas_served) — a blanket check that
       -- couldn't tell "serves this village at all" from "serves this
       -- village in THIS slot". A vendor who's only configured to
       -- cover one nearby village in the morning would previously
       -- still show slots to everyone in their full areas_served list.
       and vendor_covers_area_in_slot(v.id, p_area, sl.slot)
     group by sl.slot, w.starts, w.ends
  ) s;
  return jsonb_build_object('ok', true, 'data', res, 'now', ist_now());
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_stop_schedule(p_schedule uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update booking_schedules set is_active = false
   where id = p_schedule and customer_id = my_customer_id();
  if not found then return jsonb_build_object('ok', false, 'msg', 'Schedule nahi mila'); end if;

  update bookings set status='cancelled', cancel_reason='Schedule band kiya'
   where schedule_id = p_schedule and booking_date >= current_date
     and status in ('placed','on_the_way');

  return jsonb_build_object('ok', true, 'msg', 'Schedule band ho gaya');
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_toggle_favourite(p_product uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid := my_customer_id(); existing uuid;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  select id into existing from favourites where customer_id=cid and product_id=p_product;
  if existing is not null then
    delete from favourites where id=existing;
    return jsonb_build_object('ok', true, 'faved', false, 'msg', tr('Hata diya','Removed'));
  end if;
  insert into favourites(customer_id, product_id) values (cid, p_product)
    on conflict (customer_id, product_id) do nothing;
  return jsonb_build_object('ok', true, 'faved', true, 'msg', tr('Save ho gaya','Saved'));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_update_profile(p_name text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c customers;
begin
  update customers set name = p_name, phone = p_phone
   where auth_user_id = auth.uid() returning * into c;
  if c is null then return jsonb_build_object('ok', false, 'msg', 'Profile nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Save ho gaya', 'data', to_jsonb(c));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_vendors_for_product(p_area text, p_product_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'name', v.name, 'v_type', v.v_type,
           'photo_url', v.photo_url,
           'avg_rating', coalesce(v.avg_rating, 0),
           'total_ratings', coalesce(v.total_ratings, 0),
           'orders_completed', coalesce(oc.n, 0),
           'product_id', p.id, 'price', p.price, 'unit', p.unit, 'in_stock', p.in_stock
         ) order by coalesce(v.avg_rating,0) desc, coalesce(oc.n,0) desc), '[]'::jsonb)
    into res
    from vendors v
    join products p on p.vendor_id = v.id
    left join (select vendor_id, count(*) n from bookings
                where status in ('delivered','completed') group by vendor_id) oc on oc.vendor_id = v.id
   where v.status = 'approved' and v.is_active and p_area = any(v.areas_served)
     and p.review_status = 'approved'
     and lower(trim(p.name)) = lower(trim(p_product_name));
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_vendors_in_area(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'name', v.name, 'v_type', v.v_type,
           'photo_url', v.photo_url,
           'avg_rating', coalesce(v.avg_rating, 0),
           'total_ratings', coalesce(v.total_ratings, 0),
           'orders_completed', coalesce(oc.n, 0),
           'product_count', coalesce(pc.n, 0)
         ) order by coalesce(v.avg_rating,0) desc, coalesce(oc.n,0) desc), '[]'::jsonb)
    into res
    from vendors v
    left join (select vendor_id, count(*) n from bookings
                where status in ('delivered','completed') group by vendor_id) oc on oc.vendor_id = v.id
    left join (select vendor_id, count(*) n from products
                where in_stock and review_status='approved' group by vendor_id) pc on pc.vendor_id = v.id
   where v.status = 'approved' and v.is_active and p_area = any(v.areas_served);
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    auth.role() = 'service_role'
    or exists (select 1 from admins where auth_user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.ist_date()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (now() at time zone 'Asia/Kolkata')::date;
$function$
;

CREATE OR REPLACE FUNCTION public.ist_now()
 RETURNS timestamp without time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (now() at time zone 'Asia/Kolkata');
$function$
;

CREATE OR REPLACE FUNCTION public.ist_time()
 RETURNS time without time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (now() at time zone 'Asia/Kolkata')::time;
$function$
;

CREATE OR REPLACE FUNCTION public.job_expire_missed()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  with upd as (
    update bookings set status='missed'
     where status in ('placed','on_the_way')
       and (
         booking_date < ist_date()
         or (booking_date = ist_date() and (
              (slot='morning'   and ist_time() > time '12:00') or
              (slot='afternoon' and ist_time() > time '17:00') or
              (slot='evening'   and ist_time() > time '21:00')))
       )
    returning id
  ) select count(*) into n from upd;

  if n > 0 then
    perform notify_bi(null,'admin','missed_bookings','Missed orders','Missed orders',
      n || ' order slot khatam hone tak deliver nahi hue',
      n || ' orders were not delivered before their slot ended', null);
  end if;
  return jsonb_build_object('ok', true, 'missed', n);
end $function$
;

CREATE OR REPLACE FUNCTION public.job_price_reminders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v record; n int := 0;
begin
  for v in select vn.id, vn.auth_user_id, vn.name,
                  count(p.id) filter (where now()-p.price_updated_at > interval '24 hours') as stale
             from vendors vn join products p on p.vendor_id = vn.id
            where vn.status='approved' and vn.is_active and p.in_stock
            group by vn.id having count(p.id) filter (where now()-p.price_updated_at > interval '24 hours') > 0
  loop
    if v.auth_user_id is not null then
      perform notify_user(v.auth_user_id,'vendor','price_reminder','Aaj ka rate daalo',
        v.stale || ' saman ka rate kal ka hai — 2 minute me update kar do', null);
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'reminded', n);
end $function$
;

CREATE OR REPLACE FUNCTION public.job_spawn_recurring()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; total int := 0; n int;
begin
  for s in select id from booking_schedules
            where is_active and mode='recurring'
              and (end_date is null or end_date >= current_date) loop
    select spawned into n from spawn_schedule_bookings(s.id, 21);
    total := total + coalesce(n,0);
  end loop;
  return jsonb_build_object('ok', true, 'spawned', total);
end $function$
;

CREATE OR REPLACE FUNCTION public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2-lat1)/2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
    * power(sin(radians(lng2-lng1)/2), 2)));
$function$
;

CREATE OR REPLACE FUNCTION public.log_action(p_action text, p_entity text, p_id uuid, p_detail jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into audit_log (actor, actor_role, action, entity, entity_id, detail)
  values (auth.uid(), my_role(), p_action, p_entity, p_id, p_detail);
end $function$
;

CREATE OR REPLACE FUNCTION public.log_visit(p_page text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into site_visits(page) values (left(coalesce(p_page,'unknown'), 20));
$function$
;

CREATE OR REPLACE FUNCTION public.maps_url(p_address uuid, p_mode text DEFAULT 'driving'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a addresses; q text;
begin
  select * into a from addresses where id = p_address;
  if a is null then return null; end if;

  if a.lat is not null and a.lng is not null then
    return 'https://www.google.com/maps/dir/?api=1&destination='
           || a.lat || ',' || a.lng || '&travelmode=' || p_mode;
  end if;

  q := concat_ws(', ', nullif(a.landmark,''), nullif(a.house_no,''),
                       nullif(a.street,''), a.area, 'Haryana');
  return 'https://www.google.com/maps/dir/?api=1&destination='
         || replace(replace(q, ' ', '+'), ',', '%2C') || '&travelmode=' || p_mode;
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update notifications set is_read = true
   where id = p_id and (user_id = auth.uid() or is_admin());
  return jsonb_build_object('ok', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.match_vendor(p_type vendor_type, p_area text, p_date date, p_slot time_slot)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select v.id
    from vendors v
    left join vendor_slots vs
      on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = p_slot
   where v.status = 'approved' and v.is_active
     and v.v_type = p_type
     and vendor_covers_area_in_slot(v.id, p_area, p_slot)
     and coalesce(vs.is_open, true)
     and coalesce(vs.booked_count, 0) < coalesce(vs.capacity, v.default_capacity)
   order by coalesce(vs.booked_count,0) asc, v.avg_rating desc nulls last
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.my_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from customers where auth_user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.my_lang()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select lang from vendors   where auth_user_id = auth.uid()),
    (select lang from customers where auth_user_id = auth.uid()),
    'hi');
$function$
;

CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb; l text;
begin
  l := my_lang();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.type, 'booking_id', n.booking_id,
      'is_read', n.is_read, 'created_at', n.created_at,
      'title',   case when l='en' then coalesce(n.title_en, n.title) else n.title end,
      'message', case when l='en' then coalesce(n.message_en, n.message) else n.message end
    ) order by n.created_at desc), '[]'::jsonb) into res
  from (select * from notifications
         where user_id = auth.uid() or (role='admin' and is_admin())
         order by created_at desc limit p_limit) n;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when exists (select 1 from admins    where auth_user_id = auth.uid()) then 'admin'
    when exists (select 1 from vendors   where auth_user_id = auth.uid()) then 'vendor'
    when exists (select 1 from customers where auth_user_id = auth.uid()) then 'customer'
    else 'none' end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_vendor_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from vendors where auth_user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.notify_bi(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text, p_msg_hi text, p_msg_en text, p_booking uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  insert into notifications (user_id, role, type, title, title_en, message, message_en, booking_id)
  values (p_user, p_role, p_type, p_title_hi, p_title_en, p_msg_hi, p_msg_en, p_booking);

  -- Fire-and-forget: an actual push to the person's phone, not just a
  -- row in an inbox they might open later. pg_net queues this
  -- asynchronously, so a slow or failed push delivery never blocks or
  -- fails the booking/status-change this was called from.
  perform net.http_post(
    url:='https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/send-push',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:=jsonb_build_object('user_id', p_user, 'role', p_role,
      'title', coalesce(p_title_en, p_title_hi), 'body', coalesce(p_msg_en, p_msg_hi))
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, role, type, title, message, booking_id)
  values (p_user, p_role, p_type, p_title, p_msg, p_booking);
end $function$
;

CREATE OR REPLACE FUNCTION public.public_areas()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'name', a.name, 'lat', a.lat, 'lng', a.lng,
      'radius_km', a.radius_km, 'verified', a.coords_verified,
      'served', exists (
        select 1 from vendors v
        where v.status='approved' and v.is_active and a.name = any(v.areas_served))
    ) as x
    from areas a where a.is_active
  ) s;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text DEFAULT NULL::text, p_auth text DEFAULT NULL::text, p_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  insert into push_subscriptions(user_id, role, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), coalesce(my_role(),'customer'), p_endpoint, p_p256dh, p_auth, p_agent)
  on conflict (endpoint) do update
    set user_id=excluded.user_id, is_active=true, last_seen=now();
  return jsonb_build_object('ok', true, 'msg', tr('Alerts chalu','Alerts on'));
end $function$
;

CREATE OR REPLACE FUNCTION public.set_language(p_lang text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_lang not in ('hi','en') then
    return jsonb_build_object('ok', false, 'msg', 'Only hi or en');
  end if;
  update vendors   set lang = p_lang where auth_user_id = auth.uid();
  update customers set lang = p_lang where auth_user_id = auth.uid();
  return jsonb_build_object('ok', true, 'lang', p_lang,
    'msg', case when p_lang='en' then 'Language changed to English'
                else 'Bhasha Hindi ho gayi' end);
end $function$
;

CREATE OR REPLACE FUNCTION public.slot_window(p_slot time_slot)
 RETURNS TABLE(starts time without time zone, ends time without time zone)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case p_slot
           when 'morning'   then time '07:00'
           when 'afternoon' then time '12:00'
           when 'evening'   then time '17:00'
         end,
         case p_slot
           when 'morning'   then time '11:00'
           when 'afternoon' then time '16:00'
           when 'evening'   then time '20:00'
         end;
$function$
;

CREATE OR REPLACE FUNCTION public.spawn_schedule_bookings(p_schedule uuid, p_days integer DEFAULT 21)
 RETURNS TABLE(spawned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s booking_schedules; addr addresses; d date; vid uuid;
  bk bookings; it jsonb; prod products; total numeric; n int := 0; today date;
begin
  today := ist_date();
  select * into s from booking_schedules where id = p_schedule and is_active;
  if s is null then return query select 0; return; end if;
  select * into addr from addresses where id = s.address_id;

  d := greatest(s.start_date, today);
  while d <= least(coalesce(s.end_date, today + p_days), today + p_days) loop
    if extract(dow from d)::int = any(s.weekdays)
       and not exists (select 1 from bookings
                        where schedule_id = s.id and booking_date = d
                          and status not in ('cancelled','missed')) then
      vid := match_vendor(s.v_type, addr.area, d, s.slot);
      if vid is not null then
        insert into bookings (customer_id,vendor_id,schedule_id,address_id,v_type,booking_date,slot)
        values (s.customer_id,vid,s.id,s.address_id,s.v_type,d,s.slot) returning * into bk;
        total := 0;
        for it in select * from jsonb_array_elements(coalesce(s.template,'[]'::jsonb)) loop
          select * into prod from products where id = (it->>'product_id')::uuid;
          if prod is null then continue; end if;
          insert into booking_items (booking_id,product_id,product_name,unit,image_url,qty,price_at_booking)
          values (bk.id,prod.id,prod.name,prod.unit,prod.image_url,(it->>'qty')::numeric,prod.price);
          total := total + (it->>'qty')::numeric * prod.price;
        end loop;
        update bookings set est_total = total where id = bk.id;
        n := n + 1;
      end if;
    end if;
    d := d + 1;
  end loop;

  update booking_schedules set last_spawned = today where id = s.id;
  return query select n;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_booking_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.code is null then
    loop
      new.code := 'RB-' || lpad((floor(random()*900000)+100000)::text, 6, '0');
      exit when not exists (select 1 from bookings where code = new.code);
    end loop;
  end if;
  if new.delivery_otp is null then
    new.delivery_otp := lpad((floor(random()*10000))::text, 4, '0');
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_guard_delivered()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'delivered' and new.otp_verified_at is null then
    raise exception 'OTP verify kiye bina order delivered nahi ho sakta';
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_slot_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' and new.vendor_id is not null then
    insert into vendor_slots (vendor_id, slot_date, slot, capacity, booked_count)
    values (new.vendor_id, new.booking_date, new.slot,
            coalesce((select default_capacity from vendors where id = new.vendor_id), 15), 1)
    on conflict (vendor_id, slot_date, slot)
      do update set booked_count = vendor_slots.booked_count + 1;

  elsif tg_op = 'UPDATE'
        and new.status in ('cancelled','missed')
        and old.status not in ('cancelled','missed')
        and new.vendor_id is not null then
    update vendor_slots set booked_count = greatest(0, booked_count - 1)
     where vendor_id = new.vendor_id and slot_date = new.booking_date and slot = new.slot;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_status_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cust_auth uuid; msg text;
begin
  if new.status is distinct from old.status then
    select auth_user_id into cust_auth from customers where id = new.customer_id;
    msg := case new.status
      when 'on_the_way'    then 'Vendor nikal chuka hai'
      when 'reached'       then 'Vendor aapke ghar pahunch gaya hai'
      when 'bill_final'    then 'Bill taiyaar hai — check karke approve karo'
      when 'paid'          then 'Payment mil gaya'
      when 'delivered'     then 'Order complete! Vendor ko rate karo'
      when 'cancelled'     then 'Aapka order cancel ho gaya'
      when 'missed'        then 'Vendor nahi pahunch paya — hum dekh rahe hain'
      when 'pending_review'then 'Order review me hai, hum jaldi batayenge'
      else null end;
    if msg is not null and cust_auth is not null then
      perform notify_user(cust_auth, 'customer', 'booking_status', new.code, msg, new.id);
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_touch_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.price is distinct from old.price then
    new.price_updated_at := now();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_vendor_orders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.vendor_id is not null then
    update vendors set total_orders = total_orders + 1 where id = new.vendor_id;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_vendor_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update vendors v
     set avg_rating    = (select round(avg(stars)::numeric,1) from ratings where vendor_id = new.vendor_id),
         total_ratings = (select count(*) from ratings where vendor_id = new.vendor_id)
   where v.id = new.vendor_id;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tr(p_hi text, p_en text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case when my_lang() = 'en' then p_en else p_hi end;
$function$
;

CREATE OR REPLACE FUNCTION public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid := my_vendor_id(); c catalog_items; p products;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if p_price is null or p_price <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'Sahi rate daalo');
  end if;
  select * into c from catalog_items where key = p_key and is_active;
  if c is null then return jsonb_build_object('ok', false, 'msg', 'Ye item catalog me nahi mila'); end if;

  insert into products (vendor_id, name, name_hi, unit, price, category, catalog_key, in_stock, review_status)
  values (vid, c.name_en, c.name_hi, coalesce(p_unit, c.default_unit), p_price, c.category::vendor_type, c.key, true, 'approved')
  on conflict (vendor_id, catalog_key) where catalog_key is not null
  do update set price = excluded.price, unit = excluded.unit, in_stock = true, price_updated_at = now()
  returning * into p;
  return jsonb_build_object('ok', true, 'data', to_jsonb(p));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_apply(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text DEFAULT NULL::text, p_vehicle text DEFAULT NULL::text, p_capacity integer DEFAULT 15, p_lang text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v vendors; L text := case when p_lang='hi' then 'hi' else 'en' end;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'Please log in first' else 'Pehle login karo' end);
  end if;
  if exists (select 1 from vendors where auth_user_id = auth.uid()) then
    select * into v from vendors where auth_user_id = auth.uid();
    return jsonb_build_object('ok', true,
      'msg', case when L='en' then 'You have already applied' else 'Aapka application pehle se hai' end,
      'data', jsonb_build_object('status', v.status, 'id', v.id));
  end if;
  if exists (select 1 from vendors where phone = p_phone) then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'This phone number is already registered'
                  else 'Ye phone number pehle se juda hai' end);
  end if;
  if array_length(p_areas,1) is null then
    return jsonb_build_object('ok', false,
      'msg', case when L='en' then 'Pick at least one area' else 'Kam se kam ek area chuno' end);
  end if;

  insert into vendors (auth_user_id,name,phone,shop_name,v_type,vehicle,areas_served,
                       default_capacity,status,lang)
  values (auth.uid(),p_name,p_phone,p_shop,p_type,p_vehicle,p_areas,
          coalesce(p_capacity,15),'pending',L)
  returning * into v;

  perform notify_bi(null,'admin','vendor_application', p_name, p_name,
    p_name || ' (' || p_phone || ') ne vendor banne ke liye apply kiya',
    p_name || ' (' || p_phone || ') applied to become a vendor', null);
  perform log_action('vendor_applied','vendor',v.id,null);

  return jsonb_build_object('ok', true,
    'msg', case when L='en' then 'Application sent — admin will review'
                else 'Application bhej diya — admin check karega' end,
    'data', jsonb_build_object('id', v.id, 'status', v.status));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_bookings(p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg((to_jsonb(b) - 'delivery_otp' - 'otp_issue_note') || jsonb_build_object(
           'maps_url', maps_url(b.address_id),
           'has_pin', (b.lat is not null and b.lng is not null)
         ) order by b.slot, b.area, b.created_at), '[]'::jsonb)
    into res from (
      select * from booking_full
       where vendor_id = my_vendor_id() and booking_date = p_date
         and status not in ('cancelled')
    ) b;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_bulk_prices(p_prices jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare vid uuid; it jsonb; n int := 0;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  for it in select * from jsonb_array_elements(p_prices) loop
    update products set price = (it->>'price')::numeric
     where id = (it->>'id')::uuid and vendor_id = vid
       and price is distinct from (it->>'price')::numeric;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'msg',
    tr(n || ' rate update ho gaye', n || ' prices updated'));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_cancel_booking(p_booking uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if coalesce(trim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'msg', tr('Wajah likhna zaroori hai','A reason is required'));
  end if;
  update bookings set status='cancelled', cancel_reason='Vendor: '||p_reason where id=p_booking;
  perform notify_bi((select auth_user_id from customers where id=bk.customer_id),
    'customer','cancelled',bk.code,bk.code,
    'Vendor order nahi kar paya: '||p_reason,
    'Vendor could not fulfil this order: '||p_reason, bk.id);
  return jsonb_build_object('ok', true, 'msg',
    tr('Cancel ho gaya, customer ko bata diya','Cancelled, customer notified'));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_covers_area_in_slot(p_vendor_id uuid, p_area text, p_slot time_slot)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when not exists (select 1 from vendors where id=p_vendor_id and p_area = any(areas_served))
      then false
    when exists (select 1 from vendor_slot_areas where vendor_id=p_vendor_id and slot=p_slot)
      then exists (select 1 from vendor_slot_areas where vendor_id=p_vendor_id and slot=p_slot and area=p_area)
    else true
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.vendor_delete_product(p_product uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from products where id=p_product and vendor_id=my_vendor_id();
  if not found then return jsonb_build_object('ok', false, 'msg', 'Product nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Hata diya');
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_earnings_range(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb; vid uuid := my_vendor_id(); span int;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  if p_from is null or p_to is null or p_from > p_to then
    return jsonb_build_object('ok', false, 'msg', 'Date range sahi nahi hai');
  end if;
  span := p_to - p_from;
  if span > 400 then
    return jsonb_build_object('ok', false, 'msg', 'Range 400 din se zyada nahi ho sakti');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'd', d::date, 'total', coalesce(t.total, 0)
         ) order by d), '[]'::jsonb)
    into res
    from generate_series(p_from, p_to, interval '1 day') d
    left join (
      select booking_date, sum(final_total) as total
        from bookings
       where vendor_id = vid and status in ('delivered','completed')
         and booking_date between p_from and p_to
       group by booking_date
    ) t on t.booking_date = d::date;
  return jsonb_build_object('ok', true, 'data', res, 'from', p_from, 'to', p_to);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_earnings_week()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb; vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor account nahi mila'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'd', d::date, 'total', coalesce(t.total, 0)
         ) order by d), '[]'::jsonb)
    into res
    from generate_series(current_date - 6, current_date, interval '1 day') d
    left join (
      select booking_date, sum(final_total) as total
        from bookings
       where vendor_id = vid and status in ('delivered','completed')
       group by booking_date
    ) t on t.booking_date = d::date;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_finalize_bill(p_booking uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings; it jsonb; prod products; total numeric := 0;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if bk.status not in ('reached','bill_final','on_the_way') then
    return jsonb_build_object('ok', false, 'msg', tr('Abhi bill final nahi kar sakte','Cannot finalize yet'));
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    if it ? 'item_id' then
      update booking_items
         set final_qty   = coalesce((it->>'final_qty')::numeric, qty),
             final_price = coalesce((it->>'final_price')::numeric, price_at_booking),
             removed     = coalesce((it->>'removed')::boolean, false)
       where id = (it->>'item_id')::uuid and booking_id = p_booking;
    else
      select * into prod from products where id = (it->>'product_id')::uuid;
      if prod is null then continue; end if;
      insert into booking_items (booking_id,product_id,product_name,unit,image_url,
                                 qty,price_at_booking,final_qty,final_price,added_at_door)
      values (p_booking,prod.id,prod.name,prod.unit,prod.image_url,
              (it->>'final_qty')::numeric,
              coalesce((it->>'final_price')::numeric, prod.price),
              (it->>'final_qty')::numeric,
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
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_get_slot_areas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid; res jsonb;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  select coalesce(jsonb_object_agg(slot, areas), '{}'::jsonb) into res
    from (select slot, jsonb_agg(area order by area) as areas
            from vendor_slot_areas where vendor_id=vid group by slot) s;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v vendors;
begin
  select * into v from vendors where auth_user_id = auth.uid();
  if v is null then
    return jsonb_build_object('ok', true, 'data', null, 'msg', 'Abhi apply nahi kiya');
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(v));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_my_pending_products()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.created_at desc)
    from products p where p.vendor_id=vid and p.review_status<>'approved'), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_my_products()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order, p.name), '[]'::jsonb) into res
    from (select id,name,name_hi,image_url,unit,price,price_updated_at,in_stock,category,sort_order,
                 review_status, review_note, catalog_key,
                 (now() - price_updated_at > interval '24 hours') as price_is_stale
            from products where vendor_id = my_vendor_id()) p;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_my_reviews(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
      'stars', r.stars, 'comment', r.comment, 'created_at', r.created_at,
      'customer_name', c.name) order by r.created_at desc)
    from ratings r
    join bookings b on b.id = r.booking_id
    join customers c on c.id = b.customer_id
    where r.vendor_id = vid limit p_limit), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_my_slots(p_from date DEFAULT CURRENT_DATE, p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare res jsonb; vid uuid;
begin
  vid := my_vendor_id();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.slot_date, x.slot), '[]'::jsonb) into res
  from (
    select d::date as slot_date, sl.slot,
           coalesce(vs.capacity, v.default_capacity) as capacity,
           coalesce(vs.booked_count,0) as booked_count,
           coalesce(vs.is_open,true) as is_open
      from generate_series(p_from, p_from + p_days, interval '1 day') d
      cross join (select unnest(enum_range(null::time_slot)) as slot) sl
      join vendors v on v.id = vid
      left join vendor_slots vs
        on vs.vendor_id=vid and vs.slot_date=d::date and vs.slot=sl.slot
  ) x;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_record_payment(p_booking uuid, p_method pay_method, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if bk.status not in ('bill_approved','bill_final') then
    return jsonb_build_object('ok', false, 'msg',
      tr('Pehle customer se bill approve karwao','Get the bill approved first'));
  end if;

  insert into payments (booking_id, method, amount)
  values (p_booking, p_method, p_amount)
  on conflict (booking_id) do update set method=excluded.method, amount=excluded.amount, paid_at=now();

  update bookings set status='paid' where id=p_booking;
  return jsonb_build_object('ok', true, 'msg',
    tr('Payment record ho gaya — ab OTP daalo','Payment recorded — now enter the OTP'));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_report_otp_issue(p_booking uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  update bookings set status='pending_review', otp_issue_note=p_reason where id=p_booking;
  perform notify_bi(null,'admin','otp_issue',bk.code,bk.code,
    'OTP problem — ' || coalesce(p_reason,''), 'OTP problem — ' || coalesce(p_reason,''), bk.id);
  return jsonb_build_object('ok', true,
    'msg', tr('Admin ko bata diya, woh check karega','Admin notified, they will review'));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_set_active(p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v vendors;
begin
  select * into v from vendors where auth_user_id = auth.uid();
  if v is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if v.status <> 'approved' then
    return jsonb_build_object('ok', false, 'msg', tr('Abhi approve nahi hue ho','Not approved yet'));
  end if;
  update vendors set is_active = p_active where id = v.id;
  return jsonb_build_object('ok', true, 'msg',
    case when p_active then tr('Aap live ho — order aayenge','You are live — orders will come')
         else tr('Aap band ho — naye order nahi aayenge','You are off — no new orders') end);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_set_capacity(p_date date, p_slot time_slot, p_capacity integer, p_open boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare vid uuid; booked int;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;

  select coalesce(booked_count,0) into booked from vendor_slots
   where vendor_id=vid and slot_date=p_date and slot=p_slot;

  if booked is not null and p_capacity < booked then
    return jsonb_build_object('ok', false, 'msg',
      tr('Pehle se ' || booked || ' order hain — capacity isse kam nahi ho sakti',
         'Already ' || booked || ' orders — capacity cannot go below that'));
  end if;

  insert into vendor_slots (vendor_id,slot_date,slot,capacity,is_open)
  values (vid,p_date,p_slot,p_capacity,p_open)
  on conflict (vendor_id,slot_date,slot)
    do update set capacity=excluded.capacity, is_open=excluded.is_open;

  return jsonb_build_object('ok', true, 'msg', tr('Capacity set ho gayi','Capacity saved'));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_set_slot_areas(p_slot time_slot, p_areas text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid; served text[];
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  select areas_served into served from vendors where id=vid;
  if p_areas is not null and exists (
    select 1 from unnest(p_areas) a where not (a = any(coalesce(served,'{}')))
  ) then
    return jsonb_build_object('ok', false,
      'msg', 'Sirf apne "Change where I go" wale gaon hi chun sakte ho');
  end if;

  delete from vendor_slot_areas where vendor_id=vid and slot=p_slot;
  if p_areas is not null and array_length(p_areas,1) > 0 then
    insert into vendor_slot_areas (vendor_id, slot, area)
    select vid, p_slot, a from unnest(p_areas) a;
  end if;
  return jsonb_build_object('ok', true, 'msg', 'Saved');
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_set_status(p_booking uuid, p_status booking_status)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if p_status not in ('on_the_way','reached') then
    return jsonb_build_object('ok', false, 'msg', tr('Ye status yahan se set nahi hota','Status not settable here'));
  end if;
  update bookings set status = p_status where id = p_booking;
  return jsonb_build_object('ok', true,
    'msg', case p_status
      when 'on_the_way' then tr('Customer ko bata diya ki aap nikal chuke ho','Customer notified you are on the way')
      else tr('Customer ko bata diya ki aap pahunch gaye','Customer notified you have arrived') end,
    'maps_url', maps_url(bk.address_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_set_stock(p_product uuid, p_in_stock boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update products set in_stock = p_in_stock
   where id = p_product and vendor_id = my_vendor_id();
  if not found then return jsonb_build_object('ok', false, 'msg', tr('Product nahi mila','Product not found')); end if;
  return jsonb_build_object('ok', true, 'msg',
    case when p_in_stock then tr('Stock me daal diya','Marked in stock')
         else tr('Out of stock kar diya','Marked out of stock') end);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_slot_route(p_date date DEFAULT CURRENT_DATE, p_slot time_slot DEFAULT NULL::time_slot, p_mode text DEFAULT 'driving'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  vid uuid; stops jsonb; legs jsonb := '[]'::jsonb;
  pts text[]; total int; i int; chunk text[]; url text;
begin
  vid := my_vendor_id();
  if vid is null then
    return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found'));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'booking_id', b.id, 'code', b.code, 'status', b.status,
           'customer', b.customer_name, 'phone', b.customer_phone,
           'label', b.addr_label, 'house_no', b.house_no, 'street', b.street,
           'landmark', b.landmark, 'area', b.area,
           'lat', b.lat, 'lng', b.lng,
           'has_pin', (b.lat is not null and b.lng is not null),
           'maps_url', maps_url(b.address_id, p_mode),
           'items', b.item_count, 'est_total', b.est_total
         ) order by b.area, b.created_at), '[]'::jsonb)
    into stops
    from booking_full b
   where b.vendor_id = vid
     and b.booking_date = p_date
     and (p_slot is null or b.slot = p_slot)
     and b.status in ('placed','on_the_way','reached');

  -- build multi-stop legs from the stops that actually have coordinates
  select array_agg(s->>'coord') into pts from (
    select jsonb_build_object('coord', (s->>'lat') || ',' || (s->>'lng')) as s
      from jsonb_array_elements(stops) s
     where (s->>'has_pin')::boolean
  ) x;

  total := coalesce(array_length(pts,1), 0);
  i := 1;
  while i <= total loop
    chunk := pts[i : least(i+9, total)];
    if array_length(chunk,1) = 1 then
      url := 'https://www.google.com/maps/dir/?api=1&destination=' || chunk[1]
             || '&travelmode=' || p_mode;
    else
      url := 'https://www.google.com/maps/dir/?api=1&destination='
             || chunk[array_length(chunk,1)]
             || '&waypoints=' || array_to_string(chunk[1:array_length(chunk,1)-1], '%7C')
             || '&travelmode=' || p_mode;
    end if;
    legs := legs || jsonb_build_object(
      'leg', jsonb_array_length(legs) + 1,
      'stops', array_length(chunk,1),
      'url', url);
    i := i + 10;
  end loop;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'date', p_date, 'slot', p_slot,
    'stop_count', jsonb_array_length(stops),
    'mapped', total,
    'unmapped', jsonb_array_length(stops) - total,
    'stops', stops,
    'route_legs', legs));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare vid uuid; res jsonb;
begin
  vid := my_vendor_id();
  select jsonb_build_object(
    'today_orders',    (select count(*) from bookings where vendor_id=vid and booking_date=current_date and status<>'cancelled'),
    'today_pending',   (select count(*) from bookings where vendor_id=vid and booking_date=current_date and status in ('placed','on_the_way','reached')),
    'completed',       (select count(*) from bookings where vendor_id=vid and status='completed' and booking_date >= current_date - p_days),
    'sales',           (select coalesce(sum(p.amount),0) from payments p join bookings b on b.id=p.booking_id
                          where b.vendor_id=vid and b.booking_date >= current_date - p_days),
    'avg_rating',      (select avg_rating from vendors where id=vid),
    'total_ratings',   (select total_ratings from vendors where id=vid),
    'stale_prices',    (select count(*) from products where vendor_id=vid and in_stock
                          and now() - price_updated_at > interval '24 hours')
  ) into res;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_upcoming(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg((to_jsonb(b) - 'delivery_otp' - 'otp_issue_note')
           order by b.booking_date, b.slot), '[]'::jsonb)
    into res from (
      select * from booking_full
       where vendor_id = my_vendor_id()
         and booking_date between current_date and current_date + p_days
         and status in ('placed','on_the_way')
    ) b;
  return jsonb_build_object('ok', true, 'data', res);
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_update_profile(p_name text DEFAULT NULL::text, p_shop text DEFAULT NULL::text, p_vehicle text DEFAULT NULL::text, p_areas text[] DEFAULT NULL::text[], p_capacity integer DEFAULT NULL::integer, p_photo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v vendors;
begin
  update vendors set
    name             = coalesce(p_name, name),
    shop_name        = coalesce(p_shop, shop_name),
    vehicle          = coalesce(p_vehicle, vehicle),
    areas_served     = coalesce(p_areas, areas_served),
    default_capacity = coalesce(p_capacity, default_capacity),
    photo_url        = coalesce(p_photo, photo_url)
  where auth_user_id = auth.uid() returning * into v;
  if v is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', 'Save ho gaya', 'data', to_jsonb(v));
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text DEFAULT NULL::text, p_sort integer DEFAULT 0, p_product_id uuid DEFAULT NULL::uuid, p_name_hi text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid; p products;
begin
  vid := my_vendor_id();
  if vid is null then return jsonb_build_object('ok', false, 'msg', 'Vendor nahi mila'); end if;
  if p_price is null or p_price < 0 then
    return jsonb_build_object('ok', false, 'msg', 'Sahi rate daalo');
  end if;

  if p_product_id is null then
    insert into products (vendor_id,name,name_hi,unit,price,category,image_url,sort_order,review_status)
    values (vid,p_name,p_name_hi,p_unit,p_price,p_category::vendor_type,p_image,p_sort,'pending')
    returning * into p;
    return jsonb_build_object('ok', true,
      'msg', tr('Bhej diya — admin ke approve karte hi customer ko dikhega','Sent — it will show to customers once an admin approves it'),
      'data', to_jsonb(p));
  else
    update products set name=p_name, name_hi=p_name_hi, unit=p_unit, price=p_price,
           category=p_category::vendor_type, image_url=coalesce(p_image,image_url), sort_order=p_sort
     where id=p_product_id and vendor_id=vid returning * into p;
    if p is null then return jsonb_build_object('ok', false, 'msg', 'Product nahi mila'); end if;
    return jsonb_build_object('ok', true, 'msg', tr('Save ho gaya','Saved'), 'data', to_jsonb(p));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.vendor_verify_otp(p_booking uuid, p_otp text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bk bookings;
begin
  select * into bk from bookings where id=p_booking and vendor_id=my_vendor_id();
  if bk is null then return jsonb_build_object('ok', false, 'msg', tr('Order nahi mila','Order not found')); end if;
  if bk.otp_verified_at is not null then
    return jsonb_build_object('ok', true, 'msg', tr('Pehle hi verify ho chuka hai','Already verified'));
  end if;
  if bk.status <> 'paid' then
    return jsonb_build_object('ok', false, 'msg', tr('Pehle payment record karo','Record the payment first'));
  end if;
  if bk.otp_attempts >= 5 then
    update bookings set status='pending_review' where id=p_booking;
    perform notify_bi(null,'admin','otp_locked',bk.code,bk.code,
      '5 galat OTP — review chahiye','5 wrong OTP attempts — needs review',bk.id);
    return jsonb_build_object('ok', false,
      'msg', tr('Bahut baar galat OTP. Admin dekhega.','Too many wrong attempts. Admin will review.'));
  end if;

  if bk.delivery_otp = trim(p_otp) then
    update bookings set otp_verified_at = now(), status = 'delivered' where id = p_booking;
    perform log_action('otp_verified','booking',p_booking,null);
    return jsonb_build_object('ok', true, 'msg', tr('Order complete!','Order complete!'));
  else
    update bookings set otp_attempts = otp_attempts + 1 where id = p_booking;
    return jsonb_build_object('ok', false, 'msg', tr('OTP galat hai','Wrong OTP'),
      'attempts_left', 4 - bk.otp_attempts);
  end if;
end $function$
;

-- ===== Tables =====

create table public.addresses (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  label text default 'Ghar'::text,
  house_no text,
  street text,
  landmark text,
  area text not null,
  lat double precision,
  lng double precision,
  is_default boolean default false,
  created_at timestamp with time zone default now()
);

create table public.admins (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid not null,
  name text,
  created_at timestamp with time zone default now()
);

create table public.areas (
  id uuid default gen_random_uuid() not null,
  name text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  lat double precision,
  lng double precision,
  radius_km numeric default 4,
  coords_verified boolean default false,
  sort_order integer default 0
);

create table public.audit_log (
  id uuid default gen_random_uuid() not null,
  actor uuid,
  actor_role text,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb,
  created_at timestamp with time zone default now()
);

create table public.booking_items (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  product_id uuid,
  product_name text not null,
  unit text,
  image_url text,
  qty numeric(10,2) not null,
  price_at_booking numeric(10,2) not null,
  final_qty numeric(10,2),
  final_price numeric(10,2),
  added_at_door boolean default false,
  removed boolean default false
);

create table public.booking_schedules (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  address_id uuid not null,
  v_type vendor_type not null,
  mode schedule_mode default 'one_time'::schedule_mode not null,
  weekdays integer[] default '{}'::integer[],
  slot time_slot not null,
  start_date date not null,
  end_date date,
  is_active boolean default true,
  template jsonb default '[]'::jsonb,
  last_spawned date,
  created_at timestamp with time zone default now()
);

create table public.bookings (
  id uuid default gen_random_uuid() not null,
  code text,
  customer_id uuid not null,
  vendor_id uuid,
  schedule_id uuid,
  address_id uuid not null,
  v_type vendor_type not null,
  booking_date date not null,
  slot time_slot not null,
  status booking_status default 'placed'::booking_status not null,
  delivery_otp text not null,
  otp_verified_at timestamp with time zone,
  otp_attempts integer default 0,
  otp_issue_note text,
  bill_final_at timestamp with time zone,
  bill_approved_at timestamp with time zone,
  est_total numeric(10,2) default 0,
  final_total numeric(10,2),
  note text,
  cancel_reason text,
  dispute_reason text,
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.catalog_items (
  key text not null,
  name_en text not null,
  name_hi text not null,
  desc_en text not null,
  desc_hi text not null,
  category text not null,
  default_unit text not null,
  art_key text not null,
  is_active boolean default true not null,
  sort_order integer default 0 not null
);

create table public.customers (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid not null,
  auth_provider text default 'google'::text,
  name text,
  email text,
  phone text,
  is_blocked boolean default false,
  created_at timestamp with time zone default now(),
  lang text default 'hi'::text
);

create table public.favourites (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  product_id uuid not null,
  created_at timestamp with time zone default now()
);

create table public.messages (
  id uuid default gen_random_uuid() not null,
  name text not null,
  phone text,
  email text,
  body text not null,
  customer_id uuid,
  is_read boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  role text not null,
  type text not null,
  title text,
  message text not null,
  booking_id uuid,
  is_read boolean default false,
  created_at timestamp with time zone default now(),
  title_en text,
  message_en text
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  method pay_method not null,
  amount numeric(10,2) not null,
  paid_at timestamp with time zone default now()
);

create table public.products (
  id uuid default gen_random_uuid() not null,
  vendor_id uuid not null,
  name text not null,
  image_url text,
  unit text default 'kg'::text not null,
  price numeric(10,2) not null,
  price_updated_at timestamp with time zone default now(),
  in_stock boolean default true,
  category vendor_type not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  review_status product_review_status default 'pending'::product_review_status not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  catalog_key text,
  name_hi text
);

create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  role text default 'customer'::text not null,
  endpoint text not null,
  p256dh text,
  auth_key text,
  user_agent text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  last_seen timestamp with time zone default now()
);

create table public.ratings (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  vendor_id uuid not null,
  stars integer not null,
  comment text,
  created_at timestamp with time zone default now()
);

create table public.site_visits (
  id bigint not null generated always as identity,
  page text not null,
  visited_on date default ist_date() not null,
  created_at timestamp with time zone default now() not null
);

create table public.vendor_slot_areas (
  id uuid default gen_random_uuid() not null,
  vendor_id uuid not null,
  slot time_slot not null,
  area text not null,
  created_at timestamp with time zone default now() not null
);

create table public.vendor_slots (
  id uuid default gen_random_uuid() not null,
  vendor_id uuid not null,
  slot_date date not null,
  slot time_slot not null,
  capacity integer default 15 not null,
  booked_count integer default 0 not null,
  is_open boolean default true
);

create table public.vendors (
  id uuid default gen_random_uuid() not null,
  auth_user_id uuid,
  name text not null,
  phone text not null,
  shop_name text,
  v_type vendor_type not null,
  vehicle text,
  areas_served text[] default '{}'::text[] not null,
  status vendor_status default 'pending'::vendor_status not null,
  applied_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  review_note text,
  is_active boolean default true,
  default_capacity integer default 15,
  photo_url text,
  avg_rating numeric(2,1) default 0,
  total_ratings integer default 0,
  total_orders integer default 0,
  created_at timestamp with time zone default now(),
  lang text default 'en'::text
);

create table public.waitlist (
  id uuid default gen_random_uuid() not null,
  customer_id uuid,
  area text not null,
  v_type vendor_type not null,
  phone text,
  notified boolean default false,
  created_at timestamp with time zone default now()
);

-- ===== Constraints =====

alter table public.addresses add constraint addresses_pkey PRIMARY KEY (id);
alter table public.admins add constraint admins_pkey PRIMARY KEY (id);
alter table public.areas add constraint areas_pkey PRIMARY KEY (id);
alter table public.audit_log add constraint audit_log_pkey PRIMARY KEY (id);
alter table public.booking_items add constraint booking_items_pkey PRIMARY KEY (id);
alter table public.booking_schedules add constraint booking_schedules_pkey PRIMARY KEY (id);
alter table public.bookings add constraint bookings_pkey PRIMARY KEY (id);
alter table public.catalog_items add constraint catalog_items_pkey PRIMARY KEY (key);
alter table public.customers add constraint customers_pkey PRIMARY KEY (id);
alter table public.favourites add constraint favourites_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.ratings add constraint ratings_pkey PRIMARY KEY (id);
alter table public.site_visits add constraint site_visits_pkey PRIMARY KEY (id);
alter table public.vendor_slot_areas add constraint vendor_slot_areas_pkey PRIMARY KEY (id);
alter table public.vendor_slots add constraint vendor_slots_pkey PRIMARY KEY (id);
alter table public.vendors add constraint vendors_pkey PRIMARY KEY (id);
alter table public.waitlist add constraint waitlist_pkey PRIMARY KEY (id);
alter table public.admins add constraint admins_auth_user_id_key UNIQUE (auth_user_id);
alter table public.areas add constraint areas_name_key UNIQUE (name);
alter table public.bookings add constraint bookings_code_key UNIQUE (code);
alter table public.customers add constraint customers_auth_user_id_key UNIQUE (auth_user_id);
alter table public.favourites add constraint favourites_customer_id_product_id_key UNIQUE (customer_id, product_id);
alter table public.payments add constraint payments_booking_id_key UNIQUE (booking_id);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.ratings add constraint ratings_booking_id_key UNIQUE (booking_id);
alter table public.vendor_slot_areas add constraint vendor_slot_areas_vendor_id_slot_area_key UNIQUE (vendor_id, slot, area);
alter table public.vendor_slots add constraint vendor_slots_vendor_id_slot_date_slot_key UNIQUE (vendor_id, slot_date, slot);
alter table public.vendors add constraint vendors_auth_user_id_key UNIQUE (auth_user_id);
alter table public.vendors add constraint vendors_phone_key UNIQUE (phone);
alter table public.booking_items add constraint booking_items_qty_check CHECK ((qty > (0)::numeric));
alter table public.catalog_items add constraint catalog_items_category_check CHECK ((category = ANY (ARRAY['vegetable'::text, 'fruit'::text, 'onion_potato'::text])));
alter table public.products add constraint products_price_check CHECK ((price >= (0)::numeric));
alter table public.ratings add constraint ratings_stars_check CHECK (((stars >= 1) AND (stars <= 5)));
alter table public.addresses add constraint addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.admins add constraint admins_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.booking_items add constraint booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.booking_items add constraint booking_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.booking_schedules add constraint booking_schedules_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE;
alter table public.booking_schedules add constraint booking_schedules_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.bookings add constraint bookings_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id);
alter table public.bookings add constraint bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.bookings add constraint bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES booking_schedules(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
alter table public.customers add constraint customers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.favourites add constraint favourites_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.favourites add constraint favourites_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
alter table public.notifications add constraint notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.products add constraint products_catalog_key_fkey FOREIGN KEY (catalog_key) REFERENCES catalog_items(key);
alter table public.products add constraint products_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
alter table public.products add constraint products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ratings add constraint ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.ratings add constraint ratings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
alter table public.vendor_slot_areas add constraint vendor_slot_areas_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
alter table public.vendor_slots add constraint vendor_slots_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
alter table public.vendors add constraint vendors_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.waitlist add constraint waitlist_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ===== Indexes =====

CREATE INDEX idx_addr_cust ON public.addresses USING btree (customer_id);
CREATE INDEX idx_audit ON public.audit_log USING btree (entity, entity_id, created_at DESC);
CREATE INDEX idx_items ON public.booking_items USING btree (booking_id);
CREATE INDEX idx_sched_active ON public.booking_schedules USING btree (is_active, mode);
CREATE INDEX idx_bk_cust ON public.bookings USING btree (customer_id, created_at DESC);
CREATE INDEX idx_bk_status ON public.bookings USING btree (status);
CREATE INDEX idx_bk_vendor ON public.bookings USING btree (vendor_id, booking_date, slot);
CREATE INDEX idx_cust_auth ON public.customers USING btree (auth_user_id);
CREATE INDEX favourites_customer_idx ON public.favourites USING btree (customer_id);
CREATE INDEX idx_notif ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX idx_prod_vendor ON public.products USING btree (vendor_id, in_stock);
CREATE INDEX products_review_idx ON public.products USING btree (review_status) WHERE (review_status = 'pending'::product_review_status);
CREATE UNIQUE INDEX products_vendor_catalog_key_uq ON public.products USING btree (vendor_id, catalog_key) WHERE (catalog_key IS NOT NULL);
CREATE INDEX push_user_idx ON public.push_subscriptions USING btree (user_id) WHERE is_active;
CREATE INDEX idx_rate_vendor ON public.ratings USING btree (vendor_id);
CREATE INDEX site_visits_day_idx ON public.site_visits USING btree (visited_on, page);
CREATE INDEX idx_vendor_slot_areas_lookup ON public.vendor_slot_areas USING btree (vendor_id, slot);
CREATE INDEX idx_slots ON public.vendor_slots USING btree (vendor_id, slot_date, slot);
CREATE INDEX idx_vend_areas ON public.vendors USING gin (areas_served);
CREATE INDEX idx_vend_auth ON public.vendors USING btree (auth_user_id);
CREATE INDEX idx_vend_status ON public.vendors USING btree (status, is_active);
CREATE INDEX idx_vend_type ON public.vendors USING btree (v_type);

-- ===== Views =====

create or replace view public.live_vendors with (security_invoker=true) as
 SELECT id,
    name,
    shop_name,
    v_type,
    areas_served,
    photo_url,
    avg_rating,
    total_ratings,
    total_orders,
    default_capacity
   FROM vendors
  WHERE status = 'approved'::vendor_status AND is_active = true;

create or replace view public.live_products with (security_invoker=true) as
 SELECT p.id,
    p.vendor_id,
    p.name,
    p.image_url,
    p.unit,
    p.price,
    p.price_updated_at,
    p.category,
    p.sort_order,
    (now() - p.price_updated_at) > '24:00:00'::interval AS price_is_stale,
    v.name AS vendor_name,
    v.areas_served
   FROM products p
     JOIN vendors v ON v.id = p.vendor_id
  WHERE p.in_stock = true AND v.status = 'approved'::vendor_status AND v.is_active = true AND p.review_status = 'approved'::product_review_status;

create or replace view public.admin_overview as
 SELECT ( SELECT count(*) AS count
           FROM vendors
          WHERE vendors.status = 'pending'::vendor_status) AS vendors_pending,
    ( SELECT count(*) AS count
           FROM live_vendors) AS vendors_live,
    ( SELECT count(*) AS count
           FROM customers) AS customers_total,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.booking_date = CURRENT_DATE) AS bookings_today,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.status = ANY (ARRAY['disputed'::booking_status, 'pending_review'::booking_status])) AS needs_attention,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.status = 'completed'::booking_status AND bookings.booking_date >= (CURRENT_DATE - 30)) AS completed_30d,
    ( SELECT count(*) AS count
           FROM waitlist
          WHERE waitlist.notified = false) AS waitlist_open;

create or replace view public.bill_diff with (security_invoker=true) as
 SELECT booking_id,
    id AS item_id,
    product_name,
    unit,
    image_url,
    qty AS booked_qty,
    price_at_booking AS booked_price,
    COALESCE(final_qty, qty) AS final_qty,
    COALESCE(final_price, price_at_booking) AS final_price,
    added_at_door,
    removed,
        CASE
            WHEN removed THEN 'removed'::text
            WHEN added_at_door THEN 'added'::text
            WHEN final_qty IS DISTINCT FROM qty OR final_price IS DISTINCT FROM price_at_booking THEN 'changed'::text
            ELSE 'same'::text
        END AS change_kind,
    COALESCE(final_qty, qty) * COALESCE(final_price, price_at_booking) - qty * price_at_booking AS delta
   FROM booking_items bi;

create or replace view public.booking_full with (security_invoker=true) as
 SELECT b.id,
    b.code,
    b.customer_id,
    b.vendor_id,
    b.schedule_id,
    b.address_id,
    b.v_type,
    b.booking_date,
    b.slot,
    b.status,
    b.delivery_otp,
    b.otp_verified_at,
    b.otp_attempts,
    b.otp_issue_note,
    b.bill_final_at,
    b.bill_approved_at,
    b.est_total,
    b.final_total,
    b.note,
    b.cancel_reason,
    b.dispute_reason,
    b.admin_note,
    b.created_at,
    b.updated_at,
    c.name AS customer_name,
    c.phone AS customer_phone,
    v.name AS vendor_name,
    v.phone AS vendor_phone,
    v.shop_name,
    a.label AS addr_label,
    a.house_no,
    a.street,
    a.landmark,
    a.area,
    a.lat,
    a.lng,
    ( SELECT count(*) AS count
           FROM booking_items bi
          WHERE bi.booking_id = b.id) AS item_count,
    ( SELECT COALESCE(jsonb_agg(to_jsonb(bi.*) ORDER BY bi.id), '[]'::jsonb) AS "coalesce"
           FROM booking_items bi
          WHERE bi.booking_id = b.id) AS items,
    p.method AS pay_method,
    p.amount AS pay_amount,
    r.stars AS rating_stars,
    r.comment AS rating_comment
   FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN addresses a ON a.id = b.address_id
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN payments p ON p.booking_id = b.id
     LEFT JOIN ratings r ON r.booking_id = b.id;

-- ===== Triggers =====

CREATE TRIGGER trg_booking_defaults BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION tg_booking_defaults();
CREATE TRIGGER trg_guard_delivered BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION tg_guard_delivered();
CREATE TRIGGER trg_slot_ins AFTER INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION tg_slot_count();
CREATE TRIGGER trg_slot_upd AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION tg_slot_count();
CREATE TRIGGER trg_status_notify AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION tg_status_notify();
CREATE TRIGGER trg_vendor_orders AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION tg_vendor_orders();
CREATE TRIGGER trg_touch_price BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION tg_touch_price();
CREATE TRIGGER trg_vendor_rating AFTER INSERT ON ratings FOR EACH ROW EXECUTE FUNCTION tg_vendor_rating();

-- ===== Row level security =====

alter table public.addresses enable row level security;
alter table public.admins enable row level security;
alter table public.areas enable row level security;
alter table public.audit_log enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_schedules enable row level security;
alter table public.bookings enable row level security;
alter table public.catalog_items enable row level security;
alter table public.customers enable row level security;
alter table public.favourites enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.products enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ratings enable row level security;
alter table public.site_visits enable row level security;
alter table public.vendor_slot_areas enable row level security;
alter table public.vendor_slots enable row level security;
alter table public.vendors enable row level security;
alter table public.waitlist enable row level security;

-- ===== Policies =====

create policy p_addr_read on public.addresses as permissive for select to public using (((customer_id = my_customer_id()) OR is_admin() OR (id IN ( SELECT bookings.address_id
   FROM bookings
  WHERE (bookings.vendor_id = my_vendor_id())))));
create policy p_addr_write on public.addresses as permissive for all to public using (((customer_id = my_customer_id()) OR is_admin())) with check (((customer_id = my_customer_id()) OR is_admin()));
create policy p_admins_read on public.admins as permissive for select to public using (((auth_user_id = auth.uid()) OR is_admin()));
create policy p_areas_read on public.areas as permissive for select to public using (true);
create policy p_areas_write on public.areas as permissive for all to public using (is_admin()) with check (is_admin());
create policy p_audit on public.audit_log as permissive for select to public using (is_admin());
create policy p_items_read on public.booking_items as permissive for select to public using (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE ((bookings.customer_id = my_customer_id()) OR (bookings.vendor_id = my_vendor_id())))) OR is_admin()));
create policy p_items_write on public.booking_items as permissive for all to public using (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE ((bookings.customer_id = my_customer_id()) OR (bookings.vendor_id = my_vendor_id())))) OR is_admin())) with check (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE ((bookings.customer_id = my_customer_id()) OR (bookings.vendor_id = my_vendor_id())))) OR is_admin()));
create policy p_sched on public.booking_schedules as permissive for all to public using (((customer_id = my_customer_id()) OR is_admin())) with check (((customer_id = my_customer_id()) OR is_admin()));
create policy p_bk_insert on public.bookings as permissive for insert to public with check (((customer_id = my_customer_id()) OR is_admin()));
create policy p_bk_read on public.bookings as permissive for select to public using (((customer_id = my_customer_id()) OR (vendor_id = my_vendor_id()) OR is_admin()));
create policy p_bk_update on public.bookings as permissive for update to public using (((customer_id = my_customer_id()) OR (vendor_id = my_vendor_id()) OR is_admin())) with check (((customer_id = my_customer_id()) OR (vendor_id = my_vendor_id()) OR is_admin()));
create policy catalog_read_all on public.catalog_items as permissive for select to anon, authenticated using (true);
create policy p_cust_self on public.customers as permissive for select to public using (((auth_user_id = auth.uid()) OR is_admin() OR (id IN ( SELECT bookings.customer_id
   FROM bookings
  WHERE (bookings.vendor_id = my_vendor_id())))));
create policy p_cust_update on public.customers as permissive for update to public using (((auth_user_id = auth.uid()) OR is_admin())) with check (((auth_user_id = auth.uid()) OR is_admin()));
create policy p_cust_write on public.customers as permissive for insert to public with check ((auth_user_id = auth.uid()));
create policy fav_own on public.favourites as permissive for all to public using ((customer_id = my_customer_id())) with check ((customer_id = my_customer_id()));
create policy messages_insert_anyone on public.messages as permissive for insert to anon, authenticated with check (true);
create policy messages_select_admin on public.messages as permissive for select to authenticated using (is_admin());
create policy p_notif_read on public.notifications as permissive for select to public using (((user_id = auth.uid()) OR ((role = 'admin'::text) AND is_admin())));
create policy p_notif_update on public.notifications as permissive for update to public using (((user_id = auth.uid()) OR is_admin()));
create policy p_pay on public.payments as permissive for all to public using (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE ((bookings.customer_id = my_customer_id()) OR (bookings.vendor_id = my_vendor_id())))) OR is_admin())) with check (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.vendor_id = my_vendor_id()))) OR is_admin()));
create policy p_prod_read on public.products as permissive for select to public using (((vendor_id IN ( SELECT vendors.id
   FROM vendors
  WHERE (vendors.status = 'approved'::vendor_status))) OR (vendor_id = my_vendor_id()) OR is_admin()));
create policy p_prod_write on public.products as permissive for all to public using (((vendor_id = my_vendor_id()) OR is_admin())) with check (((vendor_id = my_vendor_id()) OR is_admin()));
create policy push_own on public.push_subscriptions as permissive for all to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy p_rate_read on public.ratings as permissive for select to public using (true);
create policy p_rate_update on public.ratings as permissive for update to public using (((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.customer_id = my_customer_id()))) OR is_admin()));
create policy p_rate_write on public.ratings as permissive for insert to public with check ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.customer_id = my_customer_id()))));
create policy vendor_slot_areas_own on public.vendor_slot_areas as permissive for all to authenticated using ((vendor_id = my_vendor_id())) with check ((vendor_id = my_vendor_id()));
create policy p_slots_read on public.vendor_slots as permissive for select to public using (true);
create policy p_slots_write on public.vendor_slots as permissive for all to public using (((vendor_id = my_vendor_id()) OR is_admin())) with check (((vendor_id = my_vendor_id()) OR is_admin()));
create policy p_vend_delete on public.vendors as permissive for delete to public using (is_admin());
create policy p_vend_insert on public.vendors as permissive for insert to public with check (((auth_user_id = auth.uid()) OR is_admin()));
create policy p_vend_read on public.vendors as permissive for select to public using (((status = 'approved'::vendor_status) OR (auth_user_id = auth.uid()) OR is_admin()));
create policy p_vend_update on public.vendors as permissive for update to public using (((auth_user_id = auth.uid()) OR is_admin())) with check (((auth_user_id = auth.uid()) OR is_admin()));
create policy p_wait_insert on public.waitlist as permissive for insert to public with check (((auth.uid() IS NOT NULL) AND ((customer_id IS NULL) OR (customer_id = my_customer_id()))));
create policy p_wait_read on public.waitlist as permissive for select to public using (((customer_id = my_customer_id()) OR is_admin()));

-- ===== Function grants =====

revoke all on function public.admin_add_catalog_item(p_name_en text, p_name_hi text, p_desc_en text, p_desc_hi text, p_category text, p_default_unit text) from public, anon, authenticated;
grant execute on function public.admin_add_catalog_item(p_name_en text, p_name_hi text, p_desc_en text, p_desc_hi text, p_category text, p_default_unit text) to authenticated;
grant execute on function public.admin_add_catalog_item(p_name_en text, p_name_hi text, p_desc_en text, p_desc_hi text, p_category text, p_default_unit text) to service_role;
grant execute on function public.admin_add_catalog_item(p_name_en text, p_name_hi text, p_desc_en text, p_desc_hi text, p_category text, p_default_unit text) to public;
revoke all on function public.admin_add_vendor(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer) from public, anon, authenticated;
grant execute on function public.admin_add_vendor(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer) to authenticated;
grant execute on function public.admin_add_vendor(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer) to service_role;
revoke all on function public.admin_areas() from public, anon, authenticated;
grant execute on function public.admin_areas() to authenticated;
grant execute on function public.admin_areas() to service_role;
revoke all on function public.admin_block_customer(p_customer uuid, p_blocked boolean) from public, anon, authenticated;
grant execute on function public.admin_block_customer(p_customer uuid, p_blocked boolean) to authenticated;
grant execute on function public.admin_block_customer(p_customer uuid, p_blocked boolean) to service_role;
revoke all on function public.admin_bookings(p_date date, p_status booking_status, p_area text, p_limit integer) from public, anon, authenticated;
grant execute on function public.admin_bookings(p_date date, p_status booking_status, p_area text, p_limit integer) to authenticated;
grant execute on function public.admin_bookings(p_date date, p_status booking_status, p_area text, p_limit integer) to service_role;
revoke all on function public.admin_cancel_booking(p_booking uuid, p_reason text) from public, anon, authenticated;
grant execute on function public.admin_cancel_booking(p_booking uuid, p_reason text) to authenticated;
grant execute on function public.admin_cancel_booking(p_booking uuid, p_reason text) to service_role;
grant execute on function public.admin_cancel_booking(p_booking uuid, p_reason text) to public;
revoke all on function public.admin_capacity_watch(p_days integer) from public, anon, authenticated;
grant execute on function public.admin_capacity_watch(p_days integer) to authenticated;
grant execute on function public.admin_capacity_watch(p_days integer) to service_role;
revoke all on function public.admin_catalog_list() from public, anon, authenticated;
grant execute on function public.admin_catalog_list() to authenticated;
grant execute on function public.admin_catalog_list() to service_role;
grant execute on function public.admin_catalog_list() to public;
revoke all on function public.admin_customers(p_limit integer) from public, anon, authenticated;
grant execute on function public.admin_customers(p_limit integer) to authenticated;
grant execute on function public.admin_customers(p_limit integer) to service_role;
revoke all on function public.admin_daily_report(p_days integer) from public, anon, authenticated;
grant execute on function public.admin_daily_report(p_days integer) to authenticated;
grant execute on function public.admin_daily_report(p_days integer) to service_role;
revoke all on function public.admin_demand_gaps() from public, anon, authenticated;
grant execute on function public.admin_demand_gaps() to authenticated;
grant execute on function public.admin_demand_gaps() to service_role;
revoke all on function public.admin_finance_dashboard(p_days integer) from public, anon, authenticated;
grant execute on function public.admin_finance_dashboard(p_days integer) to authenticated;
grant execute on function public.admin_finance_dashboard(p_days integer) to service_role;
grant execute on function public.admin_finance_dashboard(p_days integer) to public;
revoke all on function public.admin_guard() from public, anon, authenticated;
grant execute on function public.admin_guard() to authenticated;
grant execute on function public.admin_guard() to service_role;
revoke all on function public.admin_link_vendor_login(p_vendor uuid, p_auth uuid) from public, anon, authenticated;
grant execute on function public.admin_link_vendor_login(p_vendor uuid, p_auth uuid) to authenticated;
grant execute on function public.admin_link_vendor_login(p_vendor uuid, p_auth uuid) to service_role;
revoke all on function public.admin_mark_message_read(p_message uuid, p_read boolean) from public, anon, authenticated;
grant execute on function public.admin_mark_message_read(p_message uuid, p_read boolean) to authenticated;
grant execute on function public.admin_mark_message_read(p_message uuid, p_read boolean) to service_role;
grant execute on function public.admin_mark_message_read(p_message uuid, p_read boolean) to public;
revoke all on function public.admin_messages(p_limit integer) from public, anon, authenticated;
grant execute on function public.admin_messages(p_limit integer) to authenticated;
grant execute on function public.admin_messages(p_limit integer) to service_role;
grant execute on function public.admin_messages(p_limit integer) to public;
revoke all on function public.admin_overview_stats() from public, anon, authenticated;
grant execute on function public.admin_overview_stats() to authenticated;
grant execute on function public.admin_overview_stats() to service_role;
revoke all on function public.admin_pending_products() from public, anon, authenticated;
grant execute on function public.admin_pending_products() to authenticated;
grant execute on function public.admin_pending_products() to service_role;
revoke all on function public.admin_products() from public, anon, authenticated;
grant execute on function public.admin_products() to authenticated;
grant execute on function public.admin_products() to service_role;
grant execute on function public.admin_products() to public;
revoke all on function public.admin_reassign_booking(p_booking uuid, p_vendor uuid) from public, anon, authenticated;
grant execute on function public.admin_reassign_booking(p_booking uuid, p_vendor uuid) to authenticated;
grant execute on function public.admin_reassign_booking(p_booking uuid, p_vendor uuid) to service_role;
revoke all on function public.admin_recompute_area_coords(p_min_samples integer) from public, anon, authenticated;
grant execute on function public.admin_recompute_area_coords(p_min_samples integer) to authenticated;
grant execute on function public.admin_recompute_area_coords(p_min_samples integer) to service_role;
revoke all on function public.admin_remove_catalog_item(p_key text) from public, anon, authenticated;
grant execute on function public.admin_remove_catalog_item(p_key text) to authenticated;
grant execute on function public.admin_remove_catalog_item(p_key text) to service_role;
grant execute on function public.admin_remove_catalog_item(p_key text) to public;
revoke all on function public.admin_resolve(p_booking uuid, p_status booking_status, p_note text) from public, anon, authenticated;
grant execute on function public.admin_resolve(p_booking uuid, p_status booking_status, p_note text) to authenticated;
grant execute on function public.admin_resolve(p_booking uuid, p_status booking_status, p_note text) to service_role;
revoke all on function public.admin_review_product(p_product uuid, p_decision product_review_status, p_note text) from public, anon, authenticated;
grant execute on function public.admin_review_product(p_product uuid, p_decision product_review_status, p_note text) to authenticated;
grant execute on function public.admin_review_product(p_product uuid, p_decision product_review_status, p_note text) to service_role;
revoke all on function public.admin_review_vendor(p_vendor uuid, p_decision vendor_status, p_note text) from public, anon, authenticated;
grant execute on function public.admin_review_vendor(p_vendor uuid, p_decision vendor_status, p_note text) to authenticated;
grant execute on function public.admin_review_vendor(p_vendor uuid, p_decision vendor_status, p_note text) to service_role;
revoke all on function public.admin_set_area_point(p_name text, p_lat double precision, p_lng double precision, p_radius numeric, p_verified boolean) from public, anon, authenticated;
grant execute on function public.admin_set_area_point(p_name text, p_lat double precision, p_lng double precision, p_radius numeric, p_verified boolean) to authenticated;
grant execute on function public.admin_set_area_point(p_name text, p_lat double precision, p_lng double precision, p_radius numeric, p_verified boolean) to service_role;
revoke all on function public.admin_update_product(p_product uuid, p_price numeric, p_in_stock boolean, p_name text, p_name_hi text, p_category text, p_unit text) from public, anon, authenticated;
grant execute on function public.admin_update_product(p_product uuid, p_price numeric, p_in_stock boolean, p_name text, p_name_hi text, p_category text, p_unit text) to authenticated;
grant execute on function public.admin_update_product(p_product uuid, p_price numeric, p_in_stock boolean, p_name text, p_name_hi text, p_category text, p_unit text) to service_role;
grant execute on function public.admin_update_product(p_product uuid, p_price numeric, p_in_stock boolean, p_name text, p_name_hi text, p_category text, p_unit text) to public;
revoke all on function public.admin_upsert_area(p_name text, p_active boolean) from public, anon, authenticated;
grant execute on function public.admin_upsert_area(p_name text, p_active boolean) to authenticated;
grant execute on function public.admin_upsert_area(p_name text, p_active boolean) to service_role;
revoke all on function public.admin_vendor_performance(p_days integer) from public, anon, authenticated;
grant execute on function public.admin_vendor_performance(p_days integer) to authenticated;
grant execute on function public.admin_vendor_performance(p_days integer) to service_role;
revoke all on function public.admin_vendors(p_status vendor_status) from public, anon, authenticated;
grant execute on function public.admin_vendors(p_status vendor_status) to authenticated;
grant execute on function public.admin_vendors(p_status vendor_status) to service_role;
revoke all on function public.admin_visit_stats(p_days integer) from public, anon, authenticated;
grant execute on function public.admin_visit_stats(p_days integer) to authenticated;
grant execute on function public.admin_visit_stats(p_days integer) to service_role;
revoke all on function public.area_from_point(p_lat double precision, p_lng double precision) from public, anon, authenticated;
grant execute on function public.area_from_point(p_lat double precision, p_lng double precision) to anon;
grant execute on function public.area_from_point(p_lat double precision, p_lng double precision) to authenticated;
grant execute on function public.area_from_point(p_lat double precision, p_lng double precision) to service_role;
grant execute on function public.area_from_point(p_lat double precision, p_lng double precision) to public;
revoke all on function public.catalog_items_list() from public, anon, authenticated;
grant execute on function public.catalog_items_list() to anon;
grant execute on function public.catalog_items_list() to authenticated;
grant execute on function public.catalog_items_list() to service_role;
grant execute on function public.catalog_items_list() to public;
revoke all on function public.customer_approve_bill(p_booking uuid) from public, anon, authenticated;
grant execute on function public.customer_approve_bill(p_booking uuid) to authenticated;
grant execute on function public.customer_approve_bill(p_booking uuid) to service_role;
revoke all on function public.customer_available_types(p_area text) from public, anon, authenticated;
grant execute on function public.customer_available_types(p_area text) to anon;
grant execute on function public.customer_available_types(p_area text) to authenticated;
grant execute on function public.customer_available_types(p_area text) to service_role;
grant execute on function public.customer_available_types(p_area text) to public;
revoke all on function public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text) from public, anon, authenticated;
grant execute on function public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text) to anon;
grant execute on function public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text) to authenticated;
grant execute on function public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text) to service_role;
grant execute on function public.customer_available_vendors(p_type vendor_type, p_area text, p_date date, p_slot text) to public;
revoke all on function public.customer_bill_preview(p_booking uuid) from public, anon, authenticated;
grant execute on function public.customer_bill_preview(p_booking uuid) to authenticated;
grant execute on function public.customer_bill_preview(p_booking uuid) to service_role;
revoke all on function public.customer_bootstrap(p_name text, p_phone text, p_email text, p_provider text) from public, anon, authenticated;
grant execute on function public.customer_bootstrap(p_name text, p_phone text, p_email text, p_provider text) to authenticated;
grant execute on function public.customer_bootstrap(p_name text, p_phone text, p_email text, p_provider text) to service_role;
revoke all on function public.customer_cancel_booking(p_booking uuid, p_reason text) from public, anon, authenticated;
grant execute on function public.customer_cancel_booking(p_booking uuid, p_reason text) to authenticated;
grant execute on function public.customer_cancel_booking(p_booking uuid, p_reason text) to service_role;
revoke all on function public.customer_catalogue(p_type vendor_type, p_area text) from public, anon, authenticated;
grant execute on function public.customer_catalogue(p_type vendor_type, p_area text) to anon;
grant execute on function public.customer_catalogue(p_type vendor_type, p_area text) to authenticated;
grant execute on function public.customer_catalogue(p_type vendor_type, p_area text) to service_role;
grant execute on function public.customer_catalogue(p_type vendor_type, p_area text) to public;
revoke all on function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text, p_vendor_id uuid) from public, anon, authenticated;
grant execute on function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text, p_vendor_id uuid) to authenticated;
grant execute on function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text, p_vendor_id uuid) to service_role;
grant execute on function public.customer_create_booking(p_type vendor_type, p_address_id uuid, p_date date, p_slot time_slot, p_items jsonb, p_note text, p_vendor_id uuid) to public;
revoke all on function public.customer_create_schedule(p_type vendor_type, p_address_id uuid, p_weekdays integer[], p_slot time_slot, p_start date, p_end date, p_items jsonb) from public, anon, authenticated;
grant execute on function public.customer_create_schedule(p_type vendor_type, p_address_id uuid, p_weekdays integer[], p_slot time_slot, p_start date, p_end date, p_items jsonb) to authenticated;
grant execute on function public.customer_create_schedule(p_type vendor_type, p_address_id uuid, p_weekdays integer[], p_slot time_slot, p_start date, p_end date, p_items jsonb) to service_role;
revoke all on function public.customer_delete_address(p_id uuid) from public, anon, authenticated;
grant execute on function public.customer_delete_address(p_id uuid) to authenticated;
grant execute on function public.customer_delete_address(p_id uuid) to service_role;
revoke all on function public.customer_dispute_bill(p_booking uuid, p_reason text) from public, anon, authenticated;
grant execute on function public.customer_dispute_bill(p_booking uuid, p_reason text) to authenticated;
grant execute on function public.customer_dispute_bill(p_booking uuid, p_reason text) to service_role;
revoke all on function public.customer_home(p_area text) from public, anon, authenticated;
grant execute on function public.customer_home(p_area text) to anon;
grant execute on function public.customer_home(p_area text) to authenticated;
grant execute on function public.customer_home(p_area text) to service_role;
grant execute on function public.customer_home(p_area text) to public;
revoke all on function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text) from public, anon, authenticated;
grant execute on function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text) to anon;
grant execute on function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text) to authenticated;
grant execute on function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text) to service_role;
grant execute on function public.customer_join_waitlist(p_area text, p_type vendor_type, p_phone text) to public;
revoke all on function public.customer_last_order() from public, anon, authenticated;
grant execute on function public.customer_last_order() to authenticated;
grant execute on function public.customer_last_order() to service_role;
revoke all on function public.customer_my_addresses() from public, anon, authenticated;
grant execute on function public.customer_my_addresses() to authenticated;
grant execute on function public.customer_my_addresses() to service_role;
revoke all on function public.customer_my_bookings(p_limit integer) from public, anon, authenticated;
grant execute on function public.customer_my_bookings(p_limit integer) to authenticated;
grant execute on function public.customer_my_bookings(p_limit integer) to service_role;
revoke all on function public.customer_phone_login(p_name text, p_phone text) from public, anon, authenticated;
grant execute on function public.customer_phone_login(p_name text, p_phone text) to anon;
grant execute on function public.customer_phone_login(p_name text, p_phone text) to authenticated;
grant execute on function public.customer_phone_login(p_name text, p_phone text) to service_role;
grant execute on function public.customer_phone_login(p_name text, p_phone text) to public;
revoke all on function public.customer_rate(p_booking uuid, p_stars integer, p_comment text) from public, anon, authenticated;
grant execute on function public.customer_rate(p_booking uuid, p_stars integer, p_comment text) to authenticated;
grant execute on function public.customer_rate(p_booking uuid, p_stars integer, p_comment text) to service_role;
revoke all on function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text, p_lat double precision, p_lng double precision, p_make_default boolean, p_address_id uuid) from public, anon, authenticated;
grant execute on function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text, p_lat double precision, p_lng double precision, p_make_default boolean, p_address_id uuid) to authenticated;
grant execute on function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text, p_area text, p_lat double precision, p_lng double precision, p_make_default boolean, p_address_id uuid) to service_role;
revoke all on function public.customer_send_message(p_name text, p_body text, p_phone text, p_email text) from public, anon, authenticated;
grant execute on function public.customer_send_message(p_name text, p_body text, p_phone text, p_email text) to anon;
grant execute on function public.customer_send_message(p_name text, p_body text, p_phone text, p_email text) to authenticated;
grant execute on function public.customer_send_message(p_name text, p_body text, p_phone text, p_email text) to service_role;
grant execute on function public.customer_send_message(p_name text, p_body text, p_phone text, p_email text) to public;
revoke all on function public.customer_set_pin(p_address uuid, p_lat double precision, p_lng double precision) from public, anon, authenticated;
grant execute on function public.customer_set_pin(p_address uuid, p_lat double precision, p_lng double precision) to authenticated;
grant execute on function public.customer_set_pin(p_address uuid, p_lat double precision, p_lng double precision) to service_role;
revoke all on function public.customer_skip_booking(p_booking uuid) from public, anon, authenticated;
grant execute on function public.customer_skip_booking(p_booking uuid) to authenticated;
grant execute on function public.customer_skip_booking(p_booking uuid) to service_role;
revoke all on function public.customer_slot_status(p_type vendor_type, p_area text, p_date date) from public, anon, authenticated;
grant execute on function public.customer_slot_status(p_type vendor_type, p_area text, p_date date) to anon;
grant execute on function public.customer_slot_status(p_type vendor_type, p_area text, p_date date) to authenticated;
grant execute on function public.customer_slot_status(p_type vendor_type, p_area text, p_date date) to service_role;
grant execute on function public.customer_slot_status(p_type vendor_type, p_area text, p_date date) to public;
revoke all on function public.customer_stop_schedule(p_schedule uuid) from public, anon, authenticated;
grant execute on function public.customer_stop_schedule(p_schedule uuid) to authenticated;
grant execute on function public.customer_stop_schedule(p_schedule uuid) to service_role;
revoke all on function public.customer_toggle_favourite(p_product uuid) from public, anon, authenticated;
grant execute on function public.customer_toggle_favourite(p_product uuid) to authenticated;
grant execute on function public.customer_toggle_favourite(p_product uuid) to service_role;
revoke all on function public.customer_update_profile(p_name text, p_phone text) from public, anon, authenticated;
grant execute on function public.customer_update_profile(p_name text, p_phone text) to authenticated;
grant execute on function public.customer_update_profile(p_name text, p_phone text) to service_role;
revoke all on function public.customer_vendors_for_product(p_area text, p_product_name text) from public, anon, authenticated;
grant execute on function public.customer_vendors_for_product(p_area text, p_product_name text) to anon;
grant execute on function public.customer_vendors_for_product(p_area text, p_product_name text) to authenticated;
grant execute on function public.customer_vendors_for_product(p_area text, p_product_name text) to service_role;
grant execute on function public.customer_vendors_for_product(p_area text, p_product_name text) to public;
revoke all on function public.customer_vendors_in_area(p_area text) from public, anon, authenticated;
grant execute on function public.customer_vendors_in_area(p_area text) to anon;
grant execute on function public.customer_vendors_in_area(p_area text) to authenticated;
grant execute on function public.customer_vendors_in_area(p_area text) to service_role;
grant execute on function public.customer_vendors_in_area(p_area text) to public;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
revoke all on function public.ist_date() from public, anon, authenticated;
grant execute on function public.ist_date() to anon;
grant execute on function public.ist_date() to authenticated;
grant execute on function public.ist_date() to service_role;
revoke all on function public.ist_now() from public, anon, authenticated;
grant execute on function public.ist_now() to anon;
grant execute on function public.ist_now() to authenticated;
grant execute on function public.ist_now() to service_role;
revoke all on function public.ist_time() from public, anon, authenticated;
grant execute on function public.ist_time() to authenticated;
grant execute on function public.ist_time() to service_role;
grant execute on function public.ist_time() to public;
revoke all on function public.job_expire_missed() from public, anon, authenticated;
grant execute on function public.job_expire_missed() to service_role;
revoke all on function public.job_price_reminders() from public, anon, authenticated;
grant execute on function public.job_price_reminders() to service_role;
revoke all on function public.job_spawn_recurring() from public, anon, authenticated;
grant execute on function public.job_spawn_recurring() to service_role;
revoke all on function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) from public, anon, authenticated;
grant execute on function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) to authenticated;
grant execute on function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) to service_role;
revoke all on function public.log_action(p_action text, p_entity text, p_id uuid, p_detail jsonb) from public, anon, authenticated;
grant execute on function public.log_action(p_action text, p_entity text, p_id uuid, p_detail jsonb) to service_role;
revoke all on function public.log_visit(p_page text) from public, anon, authenticated;
grant execute on function public.log_visit(p_page text) to anon;
grant execute on function public.log_visit(p_page text) to authenticated;
grant execute on function public.log_visit(p_page text) to service_role;
revoke all on function public.maps_url(p_address uuid, p_mode text) from public, anon, authenticated;
grant execute on function public.maps_url(p_address uuid, p_mode text) to authenticated;
grant execute on function public.maps_url(p_address uuid, p_mode text) to service_role;
revoke all on function public.mark_notification_read(p_id uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_read(p_id uuid) to authenticated;
grant execute on function public.mark_notification_read(p_id uuid) to service_role;
revoke all on function public.match_vendor(p_type vendor_type, p_area text, p_date date, p_slot time_slot) from public, anon, authenticated;
grant execute on function public.match_vendor(p_type vendor_type, p_area text, p_date date, p_slot time_slot) to service_role;
revoke all on function public.my_customer_id() from public, anon, authenticated;
grant execute on function public.my_customer_id() to anon;
grant execute on function public.my_customer_id() to authenticated;
grant execute on function public.my_customer_id() to service_role;
revoke all on function public.my_lang() from public, anon, authenticated;
grant execute on function public.my_lang() to anon;
grant execute on function public.my_lang() to authenticated;
grant execute on function public.my_lang() to service_role;
revoke all on function public.my_notifications(p_limit integer) from public, anon, authenticated;
grant execute on function public.my_notifications(p_limit integer) to authenticated;
grant execute on function public.my_notifications(p_limit integer) to service_role;
revoke all on function public.my_role() from public, anon, authenticated;
grant execute on function public.my_role() to anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_role() to service_role;
revoke all on function public.my_vendor_id() from public, anon, authenticated;
grant execute on function public.my_vendor_id() to anon;
grant execute on function public.my_vendor_id() to authenticated;
grant execute on function public.my_vendor_id() to service_role;
revoke all on function public.notify_bi(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text, p_msg_hi text, p_msg_en text, p_booking uuid) from public, anon, authenticated;
grant execute on function public.notify_bi(p_user uuid, p_role text, p_type text, p_title_hi text, p_title_en text, p_msg_hi text, p_msg_en text, p_booking uuid) to service_role;
revoke all on function public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid) from public, anon, authenticated;
grant execute on function public.notify_user(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_booking uuid) to service_role;
revoke all on function public.public_areas() from public, anon, authenticated;
grant execute on function public.public_areas() to anon;
grant execute on function public.public_areas() to authenticated;
grant execute on function public.public_areas() to service_role;
grant execute on function public.public_areas() to public;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to authenticated;
grant execute on function public.rls_auto_enable() to service_role;
grant execute on function public.rls_auto_enable() to public;
revoke all on function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_agent text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_agent text) to authenticated;
grant execute on function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_agent text) to service_role;
revoke all on function public.set_language(p_lang text) from public, anon, authenticated;
grant execute on function public.set_language(p_lang text) to authenticated;
grant execute on function public.set_language(p_lang text) to service_role;
revoke all on function public.slot_window(p_slot time_slot) from public, anon, authenticated;
grant execute on function public.slot_window(p_slot time_slot) to anon;
grant execute on function public.slot_window(p_slot time_slot) to authenticated;
grant execute on function public.slot_window(p_slot time_slot) to service_role;
revoke all on function public.spawn_schedule_bookings(p_schedule uuid, p_days integer) from public, anon, authenticated;
grant execute on function public.spawn_schedule_bookings(p_schedule uuid, p_days integer) to service_role;
revoke all on function public.tg_booking_defaults() from public, anon, authenticated;
grant execute on function public.tg_booking_defaults() to service_role;
revoke all on function public.tg_guard_delivered() from public, anon, authenticated;
grant execute on function public.tg_guard_delivered() to service_role;
revoke all on function public.tg_slot_count() from public, anon, authenticated;
grant execute on function public.tg_slot_count() to service_role;
revoke all on function public.tg_status_notify() from public, anon, authenticated;
grant execute on function public.tg_status_notify() to service_role;
revoke all on function public.tg_touch_price() from public, anon, authenticated;
grant execute on function public.tg_touch_price() to service_role;
revoke all on function public.tg_vendor_orders() from public, anon, authenticated;
grant execute on function public.tg_vendor_orders() to service_role;
revoke all on function public.tg_vendor_rating() from public, anon, authenticated;
grant execute on function public.tg_vendor_rating() to service_role;
revoke all on function public.tr(p_hi text, p_en text) from public, anon, authenticated;
grant execute on function public.tr(p_hi text, p_en text) to anon;
grant execute on function public.tr(p_hi text, p_en text) to authenticated;
grant execute on function public.tr(p_hi text, p_en text) to service_role;
revoke all on function public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text) from public, anon, authenticated;
grant execute on function public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text) to authenticated;
grant execute on function public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text) to service_role;
grant execute on function public.vendor_activate_catalog_item(p_key text, p_price numeric, p_unit text) to public;
revoke all on function public.vendor_apply(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer, p_lang text) from public, anon, authenticated;
grant execute on function public.vendor_apply(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer, p_lang text) to authenticated;
grant execute on function public.vendor_apply(p_name text, p_phone text, p_type vendor_type, p_areas text[], p_shop text, p_vehicle text, p_capacity integer, p_lang text) to service_role;
revoke all on function public.vendor_bookings(p_date date) from public, anon, authenticated;
grant execute on function public.vendor_bookings(p_date date) to authenticated;
grant execute on function public.vendor_bookings(p_date date) to service_role;
revoke all on function public.vendor_bulk_prices(p_prices jsonb) from public, anon, authenticated;
grant execute on function public.vendor_bulk_prices(p_prices jsonb) to authenticated;
grant execute on function public.vendor_bulk_prices(p_prices jsonb) to service_role;
revoke all on function public.vendor_cancel_booking(p_booking uuid, p_reason text) from public, anon, authenticated;
grant execute on function public.vendor_cancel_booking(p_booking uuid, p_reason text) to authenticated;
grant execute on function public.vendor_cancel_booking(p_booking uuid, p_reason text) to service_role;
revoke all on function public.vendor_covers_area_in_slot(p_vendor_id uuid, p_area text, p_slot time_slot) from public, anon, authenticated;
grant execute on function public.vendor_covers_area_in_slot(p_vendor_id uuid, p_area text, p_slot time_slot) to authenticated;
grant execute on function public.vendor_covers_area_in_slot(p_vendor_id uuid, p_area text, p_slot time_slot) to service_role;
grant execute on function public.vendor_covers_area_in_slot(p_vendor_id uuid, p_area text, p_slot time_slot) to public;
revoke all on function public.vendor_delete_product(p_product uuid) from public, anon, authenticated;
grant execute on function public.vendor_delete_product(p_product uuid) to authenticated;
grant execute on function public.vendor_delete_product(p_product uuid) to service_role;
revoke all on function public.vendor_earnings_range(p_from date, p_to date) from public, anon, authenticated;
grant execute on function public.vendor_earnings_range(p_from date, p_to date) to authenticated;
grant execute on function public.vendor_earnings_range(p_from date, p_to date) to service_role;
grant execute on function public.vendor_earnings_range(p_from date, p_to date) to public;
revoke all on function public.vendor_earnings_week() from public, anon, authenticated;
grant execute on function public.vendor_earnings_week() to authenticated;
grant execute on function public.vendor_earnings_week() to service_role;
grant execute on function public.vendor_earnings_week() to public;
revoke all on function public.vendor_finalize_bill(p_booking uuid, p_items jsonb) from public, anon, authenticated;
grant execute on function public.vendor_finalize_bill(p_booking uuid, p_items jsonb) to authenticated;
grant execute on function public.vendor_finalize_bill(p_booking uuid, p_items jsonb) to service_role;
revoke all on function public.vendor_get_slot_areas() from public, anon, authenticated;
grant execute on function public.vendor_get_slot_areas() to authenticated;
grant execute on function public.vendor_get_slot_areas() to service_role;
grant execute on function public.vendor_get_slot_areas() to public;
revoke all on function public.vendor_me() from public, anon, authenticated;
grant execute on function public.vendor_me() to authenticated;
grant execute on function public.vendor_me() to service_role;
revoke all on function public.vendor_my_pending_products() from public, anon, authenticated;
grant execute on function public.vendor_my_pending_products() to authenticated;
grant execute on function public.vendor_my_pending_products() to service_role;
revoke all on function public.vendor_my_products() from public, anon, authenticated;
grant execute on function public.vendor_my_products() to authenticated;
grant execute on function public.vendor_my_products() to service_role;
revoke all on function public.vendor_my_reviews(p_limit integer) from public, anon, authenticated;
grant execute on function public.vendor_my_reviews(p_limit integer) to authenticated;
grant execute on function public.vendor_my_reviews(p_limit integer) to service_role;
revoke all on function public.vendor_my_slots(p_from date, p_days integer) from public, anon, authenticated;
grant execute on function public.vendor_my_slots(p_from date, p_days integer) to authenticated;
grant execute on function public.vendor_my_slots(p_from date, p_days integer) to service_role;
revoke all on function public.vendor_record_payment(p_booking uuid, p_method pay_method, p_amount numeric) from public, anon, authenticated;
grant execute on function public.vendor_record_payment(p_booking uuid, p_method pay_method, p_amount numeric) to authenticated;
grant execute on function public.vendor_record_payment(p_booking uuid, p_method pay_method, p_amount numeric) to service_role;
revoke all on function public.vendor_report_otp_issue(p_booking uuid, p_reason text) from public, anon, authenticated;
grant execute on function public.vendor_report_otp_issue(p_booking uuid, p_reason text) to authenticated;
grant execute on function public.vendor_report_otp_issue(p_booking uuid, p_reason text) to service_role;
revoke all on function public.vendor_set_active(p_active boolean) from public, anon, authenticated;
grant execute on function public.vendor_set_active(p_active boolean) to authenticated;
grant execute on function public.vendor_set_active(p_active boolean) to service_role;
revoke all on function public.vendor_set_capacity(p_date date, p_slot time_slot, p_capacity integer, p_open boolean) from public, anon, authenticated;
grant execute on function public.vendor_set_capacity(p_date date, p_slot time_slot, p_capacity integer, p_open boolean) to authenticated;
grant execute on function public.vendor_set_capacity(p_date date, p_slot time_slot, p_capacity integer, p_open boolean) to service_role;
revoke all on function public.vendor_set_slot_areas(p_slot time_slot, p_areas text[]) from public, anon, authenticated;
grant execute on function public.vendor_set_slot_areas(p_slot time_slot, p_areas text[]) to authenticated;
grant execute on function public.vendor_set_slot_areas(p_slot time_slot, p_areas text[]) to service_role;
grant execute on function public.vendor_set_slot_areas(p_slot time_slot, p_areas text[]) to public;
revoke all on function public.vendor_set_status(p_booking uuid, p_status booking_status) from public, anon, authenticated;
grant execute on function public.vendor_set_status(p_booking uuid, p_status booking_status) to authenticated;
grant execute on function public.vendor_set_status(p_booking uuid, p_status booking_status) to service_role;
revoke all on function public.vendor_set_stock(p_product uuid, p_in_stock boolean) from public, anon, authenticated;
grant execute on function public.vendor_set_stock(p_product uuid, p_in_stock boolean) to authenticated;
grant execute on function public.vendor_set_stock(p_product uuid, p_in_stock boolean) to service_role;
revoke all on function public.vendor_slot_route(p_date date, p_slot time_slot, p_mode text) from public, anon, authenticated;
grant execute on function public.vendor_slot_route(p_date date, p_slot time_slot, p_mode text) to authenticated;
grant execute on function public.vendor_slot_route(p_date date, p_slot time_slot, p_mode text) to service_role;
revoke all on function public.vendor_stats(p_days integer) from public, anon, authenticated;
grant execute on function public.vendor_stats(p_days integer) to authenticated;
grant execute on function public.vendor_stats(p_days integer) to service_role;
revoke all on function public.vendor_upcoming(p_days integer) from public, anon, authenticated;
grant execute on function public.vendor_upcoming(p_days integer) to authenticated;
grant execute on function public.vendor_upcoming(p_days integer) to service_role;
revoke all on function public.vendor_update_profile(p_name text, p_shop text, p_vehicle text, p_areas text[], p_capacity integer, p_photo text) from public, anon, authenticated;
grant execute on function public.vendor_update_profile(p_name text, p_shop text, p_vehicle text, p_areas text[], p_capacity integer, p_photo text) to authenticated;
grant execute on function public.vendor_update_profile(p_name text, p_shop text, p_vehicle text, p_areas text[], p_capacity integer, p_photo text) to service_role;
revoke all on function public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text, p_sort integer, p_product_id uuid, p_name_hi text) from public, anon, authenticated;
grant execute on function public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text, p_sort integer, p_product_id uuid, p_name_hi text) to authenticated;
grant execute on function public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text, p_sort integer, p_product_id uuid, p_name_hi text) to service_role;
grant execute on function public.vendor_upsert_product(p_name text, p_unit text, p_price numeric, p_category text, p_image text, p_sort integer, p_product_id uuid, p_name_hi text) to public;
revoke all on function public.vendor_verify_otp(p_booking uuid, p_otp text) from public, anon, authenticated;
grant execute on function public.vendor_verify_otp(p_booking uuid, p_otp text) to authenticated;
grant execute on function public.vendor_verify_otp(p_booking uuid, p_otp text) to service_role;

-- ===== Cron jobs (pg_cron) =====

select cron.schedule('rz-expire-missed', '0 * * * *', 'select job_expire_missed()');
select cron.schedule('rz-price-reminder', '30 23 * * *', 'select job_price_reminders()');
select cron.schedule('rz-spawn-recurring', '0 20 * * *', 'select job_spawn_recurring()');
