-- 2 Nov 2026 — "anything changed?" versions of the vendor app's 20 s order poll and the admin console's 60 s refresh
-- (same idea as 20261101a for the customer site). vendor_bookings is re-sent every 20 s while the vendor app is open
-- (~2.5 KB per order of the day); admin_bookings is up to 1000 orders (~2.5 KB each) every 60 s. With p_rev = the
-- version the page already has, the reply is {ok, same:true, rev} (69 bytes) unless something changed.
-- SECURITY INVOKER: same access as the originals, which are unchanged.
create or replace function public.vendor_bookings_if_changed(p_date date, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(vendor_bookings(p_date), p_rev)
$$;
create or replace function public.admin_bookings_if_changed(p_date date default null, p_status booking_status default null,
                                                            p_area text default null, p_limit integer default 100, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(admin_bookings(p_date, p_status, p_area, p_limit), p_rev)
$$;
create or replace function public.admin_customers_if_changed(p_limit integer default 100, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(admin_customers(p_limit), p_rev)
$$;
revoke all on function public.vendor_bookings_if_changed(date, text) from public, anon;
grant execute on function public.vendor_bookings_if_changed(date, text) to authenticated;
revoke all on function public.admin_bookings_if_changed(date, booking_status, text, integer, text) from public, anon;
grant execute on function public.admin_bookings_if_changed(date, booking_status, text, integer, text) to authenticated;
revoke all on function public.admin_customers_if_changed(integer, text) from public, anon;
grant execute on function public.admin_customers_if_changed(integer, text) to authenticated;
