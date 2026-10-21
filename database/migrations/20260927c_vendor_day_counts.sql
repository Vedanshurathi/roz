-- Vendor home footer + day pills: per day, how many open orders (and per slot), how many delivered, and the sale.
-- Open = still to do (placed … paid, disputed). Sale uses the same rule as the dashboard (vendor_sale_rows).
create or replace function public.vendor_day_counts(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare vid uuid := my_vendor_id(); res jsonb;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor account nahi mila','Vendor account not found')); end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 62 then
    return jsonb_build_object('ok', false, 'msg', tr('Date range sahi nahi hai','Date range is not valid'));
  end if;
  with b as (
    select booking_date d, slot::text slot, status::text st from bookings
     where vendor_id = vid and booking_date between p_from and p_to),
  s as (select d, count(*) n, coalesce(sum(amount),0) amt from vendor_sale_rows(vid, p_from, p_to) group by d)
  select coalesce(jsonb_agg(jsonb_build_object(
      'd', g.d,
      'open', (select count(*) from b where b.d = g.d and b.st in ('placed','on_the_way','reached','bill_final','bill_approved','paid','disputed')),
      'morning', (select count(*) from b where b.d = g.d and b.slot = 'morning' and b.st in ('placed','on_the_way','reached','bill_final','bill_approved','paid','disputed')),
      'afternoon', (select count(*) from b where b.d = g.d and b.slot = 'afternoon' and b.st in ('placed','on_the_way','reached','bill_final','bill_approved','paid','disputed')),
      'evening', (select count(*) from b where b.d = g.d and b.slot = 'evening' and b.st in ('placed','on_the_way','reached','bill_final','bill_approved','paid','disputed')),
      'delivered', coalesce((select n from s where s.d = g.d), 0),
      'sale', coalesce((select amt from s where s.d = g.d), 0)
    ) order by g.d), '[]'::jsonb) into res
  from (select generate_series(p_from, p_to, interval '1 day')::date d) g;
  return jsonb_build_object('ok', true, 'data', res);
end $$;
revoke all on function public.vendor_day_counts(date, date) from public, anon;
grant execute on function public.vendor_day_counts(date, date) to authenticated;
