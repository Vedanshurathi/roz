-- Vendor dashboard: one call with everything the vendor app's Dashboard tab shows.
--
-- Why: the old earnings numbers were wrong/empty —
--   * vendor_earnings_week/range only counted status delivered/completed with a final_total,
--     so paid orders and completed orders without a final bill were missing;
--   * they used current_date (UTC) and the booking date, so an order booked for tomorrow but
--     delivered and paid today never showed up "today";
--   * vendor_stats counted payments while the chart counted final_total — two different totals.
--
-- One rule everywhere now (same as the admin / staff dashboards):
--   sale   = a booking with a payment row, or status paid / delivered / completed
--   amount = payment amount, else final_total
--   date   = the day it was paid (IST), else the booking date
-- Commission = sale × commission_rate() % — what the vendor owes RozBazaar. Customers pay
-- nothing extra; it comes out of the vendor's sale.

create or replace function public.vendor_sale_rows(p_vendor uuid, p_from date, p_to date)
returns table(booking_id uuid, d date, amount numeric, method text)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.id,
         coalesce((p.paid_at at time zone 'Asia/Kolkata')::date, b.booking_date),
         coalesce(p.amount, b.final_total, 0),
         p.method::text
    from bookings b
    left join lateral (select * from payments x where x.booking_id = b.id order by x.paid_at desc limit 1) p on true
   where b.vendor_id = p_vendor
     and (p.id is not null or b.status in ('paid','delivered','completed'))
     and coalesce((p.paid_at at time zone 'Asia/Kolkata')::date, b.booking_date) between p_from and p_to;
$$;
revoke all on function public.vendor_sale_rows(uuid, date, date) from public, anon, authenticated;

create or replace function public.vendor_dashboard(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  vid uuid := my_vendor_id();
  f date := coalesce(p_from, ist_date());
  t date := coalesce(p_to, ist_date());
  rate numeric := commission_rate();
  monthly boolean;
  res jsonb;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor account nahi mila','Vendor account not found')); end if;
  if f > t then return jsonb_build_object('ok', false, 'msg', tr('Date range sahi nahi hai','Date range is not valid')); end if;
  if t - f > 400 then return jsonb_build_object('ok', false, 'msg', tr('Range 400 din se zyada nahi ho sakti','Range can be at most 400 days')); end if;
  monthly := (t - f) > 62;

  with s as (select * from vendor_sale_rows(vid, f, t)),
  tot as (
    select coalesce(sum(amount),0) sale, count(*) orders,
           coalesce(sum(amount) filter (where method = 'cash'),0) cash,
           coalesce(sum(amount) filter (where method in ('upi_direct','online')),0) upi
      from s),
  booked as (
    select count(*) filter (where status <> 'cancelled') total,
           count(*) filter (where status = 'cancelled') cancelled,
           count(*) filter (where status = 'missed') missed,
           count(*) filter (where status in ('placed','on_the_way','reached','bill_final','bill_approved')) open
      from bookings where vendor_id = vid and booking_date between f and t),
  series as (
    select case when monthly then date_trunc('month', g)::date else g::date end k
      from generate_series(f, t, interval '1 day') g group by 1),
  chart as (
    select coalesce(jsonb_agg(jsonb_build_object('d', se.k,
             'total', coalesce((select sum(amount) from s where (case when monthly then date_trunc('month', s.d)::date else s.d end) = se.k),0),
             'orders', (select count(*) from s where (case when monthly then date_trunc('month', s.d)::date else s.d end) = se.k))
           order by se.k), '[]') j from series se),
  items as (
    select coalesce(jsonb_agg(x order by x.amount desc), '[]') j from (
      select bi.product_name name, max(bi.unit) unit,
             sum(coalesce(bi.final_qty, bi.qty)) qty,
             round(sum(coalesce(bi.final_qty, bi.qty) * coalesce(bi.final_price, bi.price_at_booking)), 0) amount
        from booking_items bi join s on s.booking_id = bi.booking_id
       where not coalesce(bi.removed, false)
       group by bi.product_name order by 4 desc limit 8) x),
  lst as (
    select coalesce(jsonb_agg(x order by x.d desc, x.code desc), '[]') j from (
      select b.code, s.d, b.slot, c.name customer, s.method, s.amount
        from s join bookings b on b.id = s.booking_id left join customers c on c.id = b.customer_id
       order by s.d desc limit 100) x)
  select jsonb_build_object(
    'from', f, 'to', t, 'monthly', monthly, 'rate', rate,
    'sale', tot.sale, 'orders', tot.orders, 'cash', tot.cash, 'upi', tot.upi,
    'other', tot.sale - tot.cash - tot.upi,
    'commission', round(tot.sale * rate / 100, 0),
    'net', tot.sale - round(tot.sale * rate / 100, 0),
    'avg', case when tot.orders > 0 then round(tot.sale / tot.orders, 0) else 0 end,
    'booked', booked.total, 'cancelled', booked.cancelled, 'missed', booked.missed, 'open', booked.open,
    'chart', chart.j, 'items', items.j, 'list', lst.j,
    'rating', (select avg_rating from vendors where id = vid),
    'ratings', (select total_ratings from vendors where id = vid),
    'month_commission', (select round(coalesce(sum(amount),0) * rate / 100, 0)
                           from vendor_sale_rows(vid, date_trunc('month', ist_date())::date, ist_date())),
    'month_sale', (select coalesce(sum(amount),0) from vendor_sale_rows(vid, date_trunc('month', ist_date())::date, ist_date()))
  ) into res
  from tot, booked, chart, items, lst;
  return jsonb_build_object('ok', true, 'data', res);
end $$;
revoke all on function public.vendor_dashboard(date, date) from public, anon;
grant execute on function public.vendor_dashboard(date, date) to authenticated;

-- the older calls (old vendor.html) use the same rule + IST now
create or replace function public.vendor_earnings_range(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb; vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor account nahi mila','Vendor account not found')); end if;
  if p_from is null or p_to is null or p_from > p_to then
    return jsonb_build_object('ok', false, 'msg', tr('Date range sahi nahi hai','Date range is not valid'));
  end if;
  if p_to - p_from > 400 then return jsonb_build_object('ok', false, 'msg', tr('Range 400 din se zyada nahi ho sakti','Range can be at most 400 days')); end if;
  select coalesce(jsonb_agg(jsonb_build_object('d', g::date,
           'total', coalesce((select sum(amount) from vendor_sale_rows(vid, p_from, p_to) s where s.d = g::date), 0)) order by g), '[]')
    into res from generate_series(p_from, p_to, interval '1 day') g;
  return jsonb_build_object('ok', true, 'data', res, 'from', p_from, 'to', p_to);
end $$;

create or replace function public.vendor_earnings_week()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select vendor_earnings_range(ist_date() - 6, ist_date());
$$;

create or replace function public.vendor_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare vid uuid := my_vendor_id(); d0 date := ist_date();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor account nahi mila','Vendor account not found')); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'today_orders',  (select count(*) from bookings where vendor_id=vid and booking_date=d0 and status<>'cancelled'),
    'today_pending', (select count(*) from bookings where vendor_id=vid and booking_date=d0 and status in ('placed','on_the_way','reached')),
    'completed',     (select count(*) from vendor_sale_rows(vid, d0 - p_days, d0)),
    'sales',         (select coalesce(sum(amount),0) from vendor_sale_rows(vid, d0 - p_days, d0)),
    'today_sale',    (select coalesce(sum(amount),0) from vendor_sale_rows(vid, d0, d0)),
    'commission_rate', commission_rate(),
    'avg_rating',    (select avg_rating from vendors where id=vid),
    'total_ratings', (select total_ratings from vendors where id=vid),
    'stale_prices',  (select count(*) from products where vendor_id=vid and in_stock
                        and now() - price_updated_at > interval '24 hours')));
end $$;
