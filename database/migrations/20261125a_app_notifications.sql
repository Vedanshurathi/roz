-- Notifications for the Android app (shop.rozbazaar.app, a WebView app).
-- A WebView has no Web Push, so the app registers a random device secret while the customer is logged in,
-- then asks app_device_poll(secret, after) in the background for new notifications and shows them itself.
-- Only a sha256 of the secret is stored. No table grants (security lockdown rule): RPCs only.

create table if not exists public.app_push_devices (
  token_hash  text primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id     uuid not null,                 -- the customer's primary auth user (owner of notifications rows)
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
alter table public.app_push_devices enable row level security;
create index if not exists app_push_devices_customer on public.app_push_devices(customer_id);

-- called by the website inside the app after login (and on every app start while logged in)
create or replace function public.customer_app_device_register(p_token text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); uid uuid := my_customer_uid(); h text; n int;
begin
  if auth.uid() is null or cid is null or uid is null then
    return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo', 'Please log in first'));
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return jsonb_build_object('ok', false, 'msg', 'bad token');
  end if;
  h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  insert into app_push_devices(token_hash, customer_id, user_id)
       values (h, cid, uid)
  on conflict (token_hash) do update set customer_id = excluded.customer_id, user_id = excluded.user_id, last_seen = now();
  -- keep at most 10 devices per customer
  select count(*) into n from app_push_devices where customer_id = cid;
  if n > 10 then
    delete from app_push_devices where token_hash in (
      select token_hash from app_push_devices where customer_id = cid order by last_seen desc offset 10);
  end if;
  return jsonb_build_object('ok', true);
end $function$;

-- called by the logged-out-or-backgrounded app with only the device secret
create or replace function public.app_device_poll(p_token text, p_after timestamptz default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare d app_push_devices; lang text; since timestamptz;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return jsonb_build_object('ok', false);
  end if;
  select * into d from app_push_devices where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if d.token_hash is null then return jsonb_build_object('ok', false, 'code', 'UNKNOWN'); end if;
  update app_push_devices set last_seen = now() where token_hash = d.token_hash;
  lang := coalesce((select c.lang from customers c where c.id = d.customer_id), 'hi');
  since := greatest(coalesce(p_after, now() - interval '30 minutes'), now() - interval '2 days');
  return jsonb_build_object('ok', true, 'now', now(), 'lang', lang, 'data', coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'booking_id', n.booking_id, 'created_at', n.created_at,
      'title',   case when lang = 'en' then coalesce(n.title_en, n.title) else n.title end,
      'message', case when lang = 'en' then coalesce(n.message_en, n.message) else n.message end)
      order by n.created_at)
    from (select * from notifications
           where user_id = d.user_id and role = 'customer' and not is_read and created_at > since
           order by created_at desc limit 10) n), '[]'::jsonb));
end $function$;

-- logout on that device
create or replace function public.app_device_forget(p_token text)
 returns jsonb language sql security definer set search_path to 'public', 'pg_temp'
as $function$
  delete from app_push_devices where p_token is not null and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  select jsonb_build_object('ok', true);
$function$;

revoke all on table public.app_push_devices from public, anon, authenticated;
revoke all on function public.customer_app_device_register(text) from public, anon;
grant execute on function public.customer_app_device_register(text) to authenticated;
revoke all on function public.app_device_poll(text, timestamptz) from public;
grant execute on function public.app_device_poll(text, timestamptz) to anon, authenticated;
revoke all on function public.app_device_forget(text) from public;
grant execute on function public.app_device_forget(text) to anon, authenticated;
