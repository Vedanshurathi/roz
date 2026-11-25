-- Security hardening (30 Sep 2026) — least privilege on RPCs + two small functions for the new API.
--
-- 1. Functions that only make sense for a logged-in user (or an admin) were executable by the
--    `anon` role (logged-out visitors) through the default PUBLIC grant. Each of them checks the
--    caller inside, but anonymous callers should never reach them at all. Logged-in people
--    (including anonymous-sign-in customers) use the `authenticated` role, so no app breaks.
-- 2. admin_areas() had no admin check — any logged-in customer could read every area incl.
--    inactive ones and vendor counts. It now calls admin_guard() like every other admin_* RPC.
-- 3. customer_me() — the API needs "who is this session" for customers (vendors have vendor_me).
-- 4. product_image(id) — vendor photos are stored as base64 data URLs inside products.image_url,
--    which made customer_home ~870 KB. The API strips them from list responses and serves each
--    photo from its own cached URL; this function fetches one photo when the API cache is cold.

do $$
declare
  fn text;
  r record;
  login_only text[] := array[
    'admin_add_catalog_item', 'admin_cancel_booking', 'admin_catalog_list', 'admin_mark_message_read',
    'admin_messages', 'admin_products', 'admin_remove_catalog_item', 'admin_update_product',
    'customer_create_booking',
    'vendor_activate_catalog_item', 'vendor_upsert_product', 'vendor_set_slot_areas', 'vendor_get_slot_areas',
    'vendor_earnings_range', 'vendor_earnings_week',
    'can_read_staff_file', 'vendor_login_email'
  ];
begin
  foreach fn in array login_only loop
    for r in select p.oid::regprocedure as sig from pg_proc p
              where p.pronamespace = 'public'::regnamespace and p.proname = fn loop
      execute format('revoke execute on function %s from public, anon', r.sig);
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
    end loop;
  end loop;
  -- event-trigger helper: never callable as an RPC
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname = 'rls_auto_enable' loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

create or replace function public.admin_areas()
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(to_jsonb(a) order by a.name), '[]'::jsonb) into res
    from (select a.*,
                 (select count(*) from vendors v
                   where a.name = any(v.areas_served) and v.status = 'approved') as vendor_count
            from areas a) a;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.customer_me()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare c customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Not logged in'); end if;
  select * into c from customers where auth_user_id = auth.uid();
  if c.id is null then return jsonb_build_object('ok', true, 'data', null); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'lang', c.lang,
    'is_blocked', coalesce(c.is_blocked, false)));
end $$;
revoke execute on function public.customer_me() from public, anon;
grant execute on function public.customer_me() to authenticated, service_role;

create or replace function public.product_image(p_id uuid)
 returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'data', jsonb_build_object('image_url', image_url))
       from products where id = p_id and image_url like 'data:image/%'),
    jsonb_build_object('ok', false, 'msg', 'No photo'));
$$;
grant execute on function public.product_image(uuid) to anon, authenticated, service_role;
