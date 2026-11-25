-- Staff app (rozbazaar.shop/staff.html): read-only access for RozBazaar employees.
-- An employee is a Supabase auth user (email + password) with a row in public.staff.
-- The only thing staff can call is staff_me() and staff_snapshot(); both are read-only
-- and leave out delivery OTPs, house address and GPS.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;   -- no policies: RPC access only
revoke all on public.staff from anon, authenticated;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select is_admin()
      or exists (select 1 from staff where auth_user_id = auth.uid() and is_active);
$$;

create or replace function public.staff_me()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare s staff;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;
  select * into s from staff where auth_user_id = auth.uid();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'name', coalesce(s.name, 'Admin'), 'is_admin', is_admin()));
end $$;

create or replace function public.staff_snapshot()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare res jsonb;
begin
  if not is_staff() then
    return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai');
  end if;

  select jsonb_build_object(
    'today', ist_date(),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'code', b.code, 'booking_date', b.booking_date, 'slot', b.slot,
        'status', b.status, 'v_type', b.v_type, 'area', b.area, 'landmark', b.landmark,
        'customer_name', b.customer_name, 'customer_phone', b.customer_phone,
        'vendor_id', b.vendor_id, 'vendor_name', b.vendor_name,
        'est_total', b.est_total, 'final_total', b.final_total,
        'pay_method', b.pay_method, 'pay_amount', b.pay_amount, 'created_at', b.created_at,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', bi.product_name, 'unit', bi.unit, 'qty', bi.qty,
                    'price_at_booking', bi.price_at_booking,
                    'final_qty', bi.final_qty, 'final_price', bi.final_price,
                    'removed', coalesce(bi.removed, false)) order by bi.id), '[]'::jsonb)
                  from booking_items bi where bi.booking_id = b.id)
      ) order by b.booking_date desc, b.slot)
      from booking_full b
      where b.booking_date >= ist_date() - 90), '[]'::jsonb),
    'vendors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'name', v.name, 'shop_name', v.shop_name, 'phone', v.phone,
        'v_type', v.v_type, 'areas_served', v.areas_served, 'status', v.status,
        'is_active', v.is_active, 'avg_rating', v.avg_rating, 'total_ratings', v.total_ratings
      ) order by v.name)
      from vendors v), '[]'::jsonb)
  ) into res;

  return jsonb_build_object('ok', true, 'data', res);
end $$;

revoke all on function public.is_staff()       from public, anon, authenticated;
revoke all on function public.staff_me()       from public, anon;
revoke all on function public.staff_snapshot() from public, anon;
grant execute on function public.staff_me()       to authenticated;
grant execute on function public.staff_snapshot() to authenticated;
