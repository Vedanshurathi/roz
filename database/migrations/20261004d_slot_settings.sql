-- 2026-10-04 · Vendor slot settings that apply to every day + live seat counting
--
-- Bug: the vendor app's Slots screen saved capacity / open-closed with vendor_set_capacity for TODAY only
-- (p_date = today). Customers booking tomorrow or later still got the default (open, 15 orders), so a vendor
-- who closed the evening slot kept getting evening orders. Now:
--   - vendor_slot_defaults (vendor, slot) = the vendor's standing capacity + open/closed for that slot;
--     slot_cap_default / slot_open_default read it (fallback vendors.default_capacity / open).
--   - every reader (customer_slot_status, customer_available_vendors, match_vendor, customer_create_booking,
--     vendor_my_slots) uses those defaults when a day has no row of its own.
--   - vendor_save_slot_settings(p_slots) saves all three slots in one call: defaults + every future day row
--     (capacity never below the orders already booked that day) + the per-slot villages.
--   - booked_count is recounted from the real bookings (status not cancelled / missed) on every insert,
--     update and delete, so a cancelled order frees its seat straight away and nothing drifts.
--   - customer_slot_status: closed slots no longer count as free seats, new `closed` flag, and an optional
--     customer_slot_status_for(..., p_vendor) so the customer sees the seats left with the vendor whose items are in the basket.

create table if not exists public.vendor_slot_defaults (
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  slot       time_slot not null,
  capacity   int not null check (capacity between 1 and 200),
  is_open    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (vendor_id, slot)
);
alter table public.vendor_slot_defaults enable row level security;
revoke all on public.vendor_slot_defaults from anon, authenticated;

create or replace function public.slot_cap_default(p_vendor uuid, p_slot time_slot) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select capacity from vendor_slot_defaults where vendor_id = p_vendor and slot = p_slot),
                  (select default_capacity from vendors where id = p_vendor), 15)
$$;
create or replace function public.slot_open_default(p_vendor uuid, p_slot time_slot) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_open from vendor_slot_defaults where vendor_id = p_vendor and slot = p_slot), true)
$$;
revoke execute on function public.slot_cap_default(uuid,time_slot) from public, anon, authenticated;
revoke execute on function public.slot_open_default(uuid,time_slot) from public, anon, authenticated;

-- ---------- live seat count ----------
create or replace function public.slot_recount(p_vendor uuid, p_date date, p_slot time_slot) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if p_vendor is null or p_date is null or p_slot is null then return; end if;
  select count(*) into n from bookings
   where vendor_id = p_vendor and booking_date = p_date and slot = p_slot
     and status not in ('cancelled','missed');
  insert into vendor_slots (vendor_id, slot_date, slot, capacity, booked_count, is_open)
  values (p_vendor, p_date, p_slot, slot_cap_default(p_vendor, p_slot), n, slot_open_default(p_vendor, p_slot))
  on conflict (vendor_id, slot_date, slot) do update set booked_count = excluded.booked_count;
end $$;
revoke execute on function public.slot_recount(uuid,date,time_slot) from public, anon, authenticated;

create or replace function public.tg_slot_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform slot_recount(new.vendor_id, new.booking_date, new.slot);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (old.vendor_id is distinct from new.vendor_id
       or old.booking_date is distinct from new.booking_date or old.slot is distinct from new.slot)) then
    perform slot_recount(old.vendor_id, old.booking_date, old.slot);
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_slot_del after delete on public.bookings for each row execute function tg_slot_count();

-- one-time resync of every stored count
update vendor_slots vs set booked_count = (select count(*) from bookings b
  where b.vendor_id = vs.vendor_id and b.booking_date = vs.slot_date and b.slot = vs.slot
    and b.status not in ('cancelled','missed'));

-- admin_reassign_booking changed the counter by hand; the trigger does it now (it would double count)
do $$
declare d text; nd text;
begin
  d := pg_get_functiondef('public.admin_reassign_booking(uuid,uuid)'::regprocedure);
  nd := regexp_replace(d, 'if\s+old_v\s+is\s+not\s+null\s+then.*?booked_count\s*\+\s*1\s*;',
                       '-- seat counts: trg_slot_upd recounts both vendors', 's');
  if nd = d then raise exception 'admin_reassign_booking: pattern not found'; end if;
  execute nd;
end $$;

-- ---------- readers use the standing settings ----------
do $$
declare r record; d text; nd text;
begin
  for r in select * from (values
      ('public.customer_available_vendors(vendor_type,text,date,text)', 'p_slot::time_slot'),
      ('public.match_vendor(vendor_type,text,date,time_slot)', 'p_slot'),
      ('public.customer_create_booking(vendor_type,uuid,date,time_slot,jsonb,text,uuid)', 'p_slot'),
      ('public.vendor_my_slots(date,integer)', 'sl.slot')) as t(fn, sl)
  loop
    d := pg_get_functiondef(r.fn::regprocedure);
    nd := regexp_replace(d, 'coalesce\(vs\.capacity,\s*v\.default_capacity\)', 'coalesce(vs.capacity, slot_cap_default(v.id, '||r.sl||'))', 'g');
    nd := regexp_replace(nd, 'coalesce\(vs\.is_open,\s*true\)', 'coalesce(vs.is_open, slot_open_default(v.id, '||r.sl||'))', 'g');
    if nd = d then raise exception '% : nothing patched', r.fn; end if;
    execute nd;
  end loop;
end $$;
alter function public.vendor_my_slots(date,integer) set search_path = public, pg_temp;
do $$
declare d text;
begin
  d := pg_get_functiondef('public.vendor_my_slots(date,integer)'::regprocedure);
  execute replace(d, 'p_from date DEFAULT CURRENT_DATE', 'p_from date DEFAULT ist_date()');
end $$;

-- (no DROP: the old 3-argument function stays and calls the new one, so the platform API keeps working)
create or replace function public.customer_slot_status_for(p_type vendor_type, p_area text, p_date date, p_vendor uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb; lead_minutes int := 60;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot', s.slot, 'free', s.free, 'is_past', s.is_past, 'starts', s.starts, 'ends', s.ends,
           'closed', s.all_closed,
           'has_room', (s.free > 0 and not s.is_past)
         ) order by s.starts), '[]'::jsonb)
    into res
  from (
    select x.slot, x.starts, x.ends,
           sum(case when x.open then greatest(0, x.cap - x.booked) else 0 end) as free,
           bool_and(not x.open) as all_closed,
           (p_date < ist_date()) or (p_date = ist_date()
             and (ist_now()::time) > (x.starts - make_interval(mins => lead_minutes))) as is_past
      from (
        select sl.slot, w.starts, w.ends,
               coalesce(vs.capacity, slot_cap_default(v.id, sl.slot)) as cap,
               coalesce(vs.booked_count, 0) as booked,
               coalesce(vs.is_open, slot_open_default(v.id, sl.slot)) as open
          from (select unnest(enum_range(null::time_slot)) as slot) sl
          cross join lateral slot_window(sl.slot) w
          cross join vendors v
          left join vendor_slots vs on vs.vendor_id = v.id and vs.slot_date = p_date and vs.slot = sl.slot
         where v.status = 'approved' and v.is_active and v.v_type = p_type
           and (p_vendor is null or v.id = p_vendor)
           and vendor_covers_area_in_slot(v.id, p_area, sl.slot)
      ) x
     group by x.slot, x.starts, x.ends
  ) s;
  return jsonb_build_object('ok', true, 'data', res, 'now', ist_now());
end $$;
grant execute on function public.customer_slot_status_for(vendor_type,text,date,uuid) to anon, authenticated;
create or replace function public.customer_slot_status(p_type vendor_type, p_area text, p_date date)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select customer_slot_status_for(p_type, p_area, p_date, null)
$$;

-- ---------- vendor: read + save the standing settings ----------
create or replace function public.vendor_get_slot_settings() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare vid uuid := my_vendor_id(); res jsonb;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  select jsonb_object_agg(sl.slot, jsonb_build_object(
           'capacity', slot_cap_default(vid, sl.slot),
           'open', slot_open_default(vid, sl.slot),
           'booked_today', coalesce((select booked_count from vendor_slots where vendor_id = vid and slot_date = ist_date() and slot = sl.slot), 0),
           'booked_tomorrow', coalesce((select booked_count from vendor_slots where vendor_id = vid and slot_date = ist_date() + 1 and slot = sl.slot), 0)))
    into res from (select unnest(enum_range(null::time_slot)) as slot) sl;
  return jsonb_build_object('ok', true, 'data', res);
end $$;
revoke execute on function public.vendor_get_slot_settings() from public, anon;
grant execute on function public.vendor_get_slot_settings() to authenticated;

create or replace function public.vendor_save_slot_settings(p_slots jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare vid uuid := my_vendor_id(); it jsonb; s time_slot; cap int; op boolean; kept jsonb := '[]'::jsonb; r record;
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if jsonb_typeof(coalesce(p_slots,'null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'msg', tr('Kuch galat hua','Something went wrong'));
  end if;
  for it in select * from jsonb_array_elements(p_slots) loop
    begin s := (it->>'slot')::time_slot; exception when others then
      return jsonb_build_object('ok', false, 'msg', tr('Kuch galat hua','Something went wrong')); end;
    begin cap := nullif(it->>'capacity','')::int; exception when others then cap := null; end;
    op  := coalesce((it->>'open')::boolean, true);
    if cap is null or cap < 1 or cap > 60 then
      return jsonb_build_object('ok', false, 'msg', tr('Orders 1 se 60 ke beech rakho','Keep orders between 1 and 60'));
    end if;
    insert into vendor_slot_defaults (vendor_id, slot, capacity, is_open, updated_at)
    values (vid, s, cap, op, now())
    on conflict (vendor_id, slot) do update set capacity = excluded.capacity, is_open = excluded.is_open, updated_at = now();
    -- every day from today on follows the new setting; a day that already has more orders keeps that many
    for r in select slot_date, booked_count from vendor_slots
              where vendor_id = vid and slot = s and slot_date >= ist_date() and booked_count > cap loop
      kept := kept || jsonb_build_object('date', r.slot_date, 'slot', s, 'booked', r.booked_count);
    end loop;
    update vendor_slots set capacity = greatest(cap, booked_count), is_open = op
     where vendor_id = vid and slot = s and slot_date >= ist_date();
    if it ? 'areas' then
      perform vendor_set_slot_areas(s, case when jsonb_typeof(it->'areas') = 'array'
                                            then array(select jsonb_array_elements_text(it->'areas')) else null end);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'msg', tr('Slot sab dino ke liye save ho gaye','Slots saved for every day'),
                            'data', jsonb_build_object('kept', kept));
end $$;
revoke execute on function public.vendor_save_slot_settings(jsonb) from public, anon;
grant execute on function public.vendor_save_slot_settings(jsonb) to authenticated;

insert into msg_i18n (roman, hi, en)
select v.roman, v.hi, v.en from (values
  ('Slot sab dino ke liye save ho gaye', 'स्लॉट सब दिनों के लिए सेव हो गए', 'Slots saved for every day'),
  ('Orders 1 se 60 ke beech rakho', 'ऑर्डर 1 से 60 के बीच रखें', 'Keep orders between 1 and 60'),
  ('Kuch galat hua', 'कुछ गलत हुआ', 'Something went wrong')
) v(roman, hi, en) where not exists (select 1 from msg_i18n m where m.roman = v.roman);

-- ---------- vendor app "All orders": every order in a date range, cancelled included ----------
create or replace function public.vendor_orders(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb; vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    return jsonb_build_object('ok', false, 'msg', tr('Tareekh sahi chuno','Choose a valid date range'));
  end if;
  select coalesce(jsonb_agg((to_jsonb(b) - 'delivery_otp' - 'otp_issue_note')
           order by b.booking_date desc, b.slot, b.created_at), '[]'::jsonb)
    into res
    from booking_full b
   where b.vendor_id = vid and b.booking_date between p_from and p_to;
  return jsonb_build_object('ok', true, 'data', res);
end $$;
revoke execute on function public.vendor_orders(date,date) from public, anon;
grant execute on function public.vendor_orders(date,date) to authenticated;
insert into msg_i18n (roman, hi, en) select 'Tareekh sahi chuno', 'सही तारीख़ चुनें', 'Choose a valid date range'
 where not exists (select 1 from msg_i18n where roman='Tareekh sahi chuno');
