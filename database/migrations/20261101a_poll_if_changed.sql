-- 1 Nov 2026 — "anything changed?" versions of the three lists the customer site keeps refreshing.
-- A logged-in customer's page re-downloaded the item list (16 KB) and their orders (16 KB) every 25 s and
-- notifications (15 KB) every 60 s — ~100 KB a minute, most of the free plan's 5 GB/month data allowance.
-- Each function below runs the existing one, hashes the reply, and when the page already has that version
-- (p_rev = hash) answers only {ok, same:true, rev} (~70 bytes). Otherwise the full reply + rev.
-- SECURITY INVOKER: exactly the same access as calling the original function. The originals are unchanged
-- (the live site and the platform/ API keep using them).

create or replace function public.rb_if_changed(p_reply jsonb, p_rev text)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when p_reply is null then jsonb_build_object('ok', false, 'msg', 'no reply')
    when p_rev is not null and p_rev = md5(p_reply::text)
      then jsonb_build_object('ok', true, 'same', true, 'rev', p_rev)
    when jsonb_typeof(p_reply) = 'object' and p_reply ? 'ok'
      then p_reply || jsonb_build_object('rev', md5(p_reply::text))
    else jsonb_build_object('ok', true, 'data', p_reply, 'rev', md5(p_reply::text))
  end
$$;

create or replace function public.customer_home_if_changed(p_area text, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(customer_home(p_area), p_rev)
$$;

create or replace function public.customer_my_bookings_if_changed(p_limit integer default 30, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(customer_my_bookings(p_limit), p_rev)
$$;

create or replace function public.customer_notifications_if_changed(p_limit integer default 40, p_rev text default null)
returns jsonb language sql security invoker set search_path = public as $$
  select rb_if_changed(customer_notifications(p_limit), p_rev)
$$;

-- same callers as the originals: the item list for everyone, orders + notifications only when logged in
revoke all on function public.rb_if_changed(jsonb, text) from public, anon, authenticated;
grant execute on function public.rb_if_changed(jsonb, text) to anon, authenticated;
revoke all on function public.customer_home_if_changed(text, text) from public;
grant execute on function public.customer_home_if_changed(text, text) to anon, authenticated;
revoke all on function public.customer_my_bookings_if_changed(integer, text) from public, anon;
grant execute on function public.customer_my_bookings_if_changed(integer, text) to authenticated;
revoke all on function public.customer_notifications_if_changed(integer, text) from public, anon;
grant execute on function public.customer_notifications_if_changed(integer, text) to authenticated;
