-- Two old bug patterns, fixed everywhere at once:
--  1. current_date is the UTC date. Between 00:00 and 05:30 IST it is still "yesterday", so e.g.
--     admin "today" numbers, vendor upcoming orders, schedule stop/cancel and the recurring-order job
--     used the wrong day. → ist_date() (lesson 5).
--  2. `if rec is null` / `if rec is not null` on a table-row variable: IS NOT NULL is false as soon as
--     ANY column is null (e.g. a booking without final_total), so found rows could be treated as
--     missing. → `rec.id is null` (`rec.key` for catalog_items) (lesson 4).
do $$
declare f record; d text; n int := 0; r record;
begin
  for f in select p.oid, p.proname, p.prosrc from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and (p.prosrc ~* '\mcurrent_date\M'
                   or p.prosrc ~* 'if\s+\w+\s+is\s+(not\s+)?null') loop
    d := pg_get_functiondef(f.oid);
    d := regexp_replace(d, '\mcurrent_date\M', 'ist_date()', 'gi');
    for r in select m[1] v, m[2] t
               from regexp_matches(f.prosrc,
                 '(?:^|[\s;])(\w+)\s+(bookings|products|vendors|customers|addresses|booking_schedules|catalog_items)\s*;', 'g') m loop
      d := regexp_replace(d, 'if\s+' || r.v || '\s+is\s+(not\s+)?null',
                          'if ' || r.v || '.' || case when r.t = 'catalog_items' then 'key' else 'id' end || ' is \1null', 'gi');
    end loop;
    if d is distinct from pg_get_functiondef(f.oid) then
      execute d; n := n + 1;
    end if;
  end loop;
  raise notice 'functions rewritten: %', n;
end $$;
