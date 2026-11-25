-- The vendor apps used to say "RozBazaar takes ₹0 commission" — wrong: vendors owe
-- commission_rate() % of their sales (customers pay nothing extra). Vendors can read the rate.
create or replace function public.vendor_commission()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('rate', commission_rate()));
$$;
revoke all on function public.vendor_commission() from public, anon;
grant execute on function public.vendor_commission() to authenticated;
