-- Several saved addresses per customer (Home, Shop, a custom name…), pick one per booking.
--  * addresses.hidden: "delete" of an address that old bookings still point to hides it
--    instead of failing on the foreign key (bookings keep their real address)
--  * customer_my_addresses: only visible ones, default first
--  * customer_set_default_address(p_id)
--  * customer_create_booking: `if addr is null` → `addr.id is null` (composite-row check, lesson 4)
alter table public.addresses add column if not exists hidden boolean not null default false;

create or replace function public.customer_my_addresses()
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := my_customer_id();
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(to_jsonb(a) order by a.is_default desc, a.created_at desc)
      from addresses a where a.customer_id = cid and not a.hidden), '[]'::jsonb));
end $$;

create or replace function public.customer_delete_address(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := my_customer_id(); was_default boolean;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  select is_default into was_default from addresses where id = p_id and customer_id = cid and not hidden;
  if not found then return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found')); end if;
  if exists (select 1 from bookings where address_id = p_id) or exists (select 1 from booking_schedules where address_id = p_id) then
    update addresses set hidden = true, is_default = false where id = p_id;
  else
    delete from addresses where id = p_id;
  end if;
  if was_default then   -- another address becomes the default
    update addresses set is_default = true where id = (
      select id from addresses where customer_id = cid and not hidden order by created_at desc limit 1);
  end if;
  return jsonb_build_object('ok', true, 'msg', tr('Address hata diya','Address removed'));
end $$;

create or replace function public.customer_set_default_address(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := my_customer_id();
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if not exists (select 1 from addresses where id = p_id and customer_id = cid and not hidden) then
    return jsonb_build_object('ok', false, 'msg', tr('Address nahi mila','Address not found'));
  end if;
  update addresses set is_default = (id = p_id) where customer_id = cid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.customer_set_default_address(uuid) from public, anon;
grant execute on function public.customer_set_default_address(uuid) to authenticated;

-- same body, only the composite-row null check changed
do $$ declare d text; begin
  d := pg_get_functiondef('public.customer_create_booking(vendor_type, uuid, date, time_slot, jsonb, text, uuid)'::regprocedure);
  if position('if addr is null then' in d) > 0 then
    execute replace(d, 'if addr is null then', 'if addr.id is null then');
  end if;
end $$;
