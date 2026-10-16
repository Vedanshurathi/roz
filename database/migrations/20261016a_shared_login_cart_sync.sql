-- 16 Oct 2026 — one customer account on several devices + a basket that follows the account.
--
-- Before: phone login on a second device moved customers.auth_user_id to that device's
-- anonymous session, so the first device silently stopped being that customer (its RPCs saw no
-- customer, its cart/orders/notifications vanished; logging in there again moved it back).
-- Now each extra device is LINKED to the same customer row (customer_logins); my_customer_id()
-- resolves both. Notifications are still stored for the customer's primary auth user
-- (customers.auth_user_id), so the 🔔 list and push subscriptions of every device use that id.
--
-- The basket lived only in each browser's localStorage. customer_carts keeps it per customer;
-- customer_cart_get / customer_cart_apply (absolute qty per product, 0 = remove) let every
-- device read and change the same basket.

create table if not exists public.customer_logins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists customer_logins_customer_idx on public.customer_logins(customer_id);
alter table public.customer_logins enable row level security;
revoke all on public.customer_logins from anon, authenticated;

create table if not exists public.customer_carts (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  items       jsonb not null default '{}'::jsonb,      -- { "<product uuid>": qty }
  vendor_id   uuid,
  rev         bigint not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.customer_carts enable row level security;
revoke all on public.customer_carts from anon, authenticated;

-- ---------- identity ----------
create or replace function public.my_customer_id()
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select coalesce((select id from customers where auth_user_id = auth.uid()),
                  (select customer_id from customer_logins where auth_user_id = auth.uid()));
$function$;

-- the customer's primary auth user — notifications + push subscriptions are kept under this id
create or replace function public.my_customer_uid()
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select auth_user_id from customers where id = my_customer_id();
$function$;
revoke execute on function public.my_customer_uid() from public, anon;
grant execute on function public.my_customer_uid() to authenticated;

create or replace function public.customer_phone_login(p_name text, p_phone text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare c customers; existing_own customers; clean_phone text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'msg', tr('Session nahi mila — dubara try karo', 'Session nahi mila — dubara try karo'));
  end if;
  clean_phone := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if length(clean_phone) <> 10 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi 10-digit number daalo', 'Sahi 10-digit number daalo'));
  end if;
  if customer_otp_on() and coalesce((select phone from auth.users where id = auth.uid()), '') <> '91' || clean_phone then
    return jsonb_build_object('ok', false, 'code', 'OTP_REQUIRED', 'msg', tr('Pehle SMS wala code daalo', 'Enter the code we sent by SMS first'));
  end if;
  if length(trim(coalesce(p_name,''))) < 1 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo', 'Naam daalo'));
  end if;

  select * into c from customers where phone = clean_phone;
  select * into existing_own from customers where auth_user_id = auth.uid();

  if existing_own.id is not null then
    -- this session already owns a customer row (Google, or the device that first used the
    -- number): the number becomes this row's, an older row with it loses it.
    if c.id is not null and c.id <> existing_own.id then
      update customers set phone = null where id = c.id;
    end if;
    update customers set phone = clean_phone, name = trim(p_name)
     where id = existing_own.id returning * into c;
  elsif c.id is not null then
    -- this number already has an account: THIS DEVICE JOINS IT. It used to take the account
    -- away from the other device (auth_user_id moved), which logged that device out silently.
    insert into customer_logins (auth_user_id, customer_id) values (auth.uid(), c.id)
      on conflict (auth_user_id) do update set customer_id = excluded.customer_id, created_at = now();
    update customers set name = trim(p_name) where id = c.id returning * into c;
  else
    delete from customer_logins where auth_user_id = auth.uid();
    insert into customers (auth_user_id, name, phone, auth_provider)
    values (auth.uid(), trim(p_name), clean_phone, 'phone')
    returning * into c;
  end if;

  return jsonb_build_object('ok', true, 'data', to_jsonb(c));
end $function$;

create or replace function public.customer_bootstrap(p_name text default null, p_phone text default null, p_email text default null, p_provider text default 'google')
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare c customers; cid uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo', 'Pehle login karo'));
  end if;
  cid := my_customer_id();
  if cid is not null and not exists (select 1 from customers where auth_user_id = auth.uid()) then
    -- a device linked to an account by phone login: never create a second, empty row for it
    update customers set name  = coalesce(p_name,  name),
                         phone = coalesce(p_phone, phone),
                         email = coalesce(p_email, email)
     where id = cid returning * into c;
  else
    insert into customers (auth_user_id, name, phone, email, auth_provider)
    values (auth.uid(), p_name, p_phone, p_email, p_provider)
    on conflict (auth_user_id) do update
      set name  = coalesce(excluded.name,  customers.name),
          phone = coalesce(excluded.phone, customers.phone),
          email = coalesce(excluded.email, customers.email)
    returning * into c;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(c),
    'msg', case when c.phone is null then 'Phone number daalna baaki hai' else 'Ready' end);
end $function$;

create or replace function public.customer_me()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare c customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Not logged in'); end if;
  select * into c from customers where id = my_customer_id();
  if c.id is null then return jsonb_build_object('ok', true, 'data', null); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'lang', c.lang,
    'is_blocked', coalesce(c.is_blocked, false)));
end $function$;

create or replace function public.customer_set_profile(p_name text, p_photo text default null, p_remove_photo boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare c customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if p_name is not null and (length(trim(p_name)) < 1 or length(p_name) > 80) then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo','Enter your name'));
  end if;
  if not rb_valid_photo(p_photo) then return jsonb_build_object('ok', false, 'msg', tr('Ye photo nahi chalegi','This photo cannot be used')); end if;
  update customers set name = coalesce(nullif(trim(p_name),''), name),
         photo_url = case when p_remove_photo then null else coalesce(p_photo, photo_url) end
   where id = my_customer_id() returning * into c;
  if c.id is null then return jsonb_build_object('ok', false, 'msg', tr('Profile nahi mila','Profile not found')); end if;
  return jsonb_build_object('ok', true, 'msg', tr('Save ho gaya','Saved'),
    'data', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'photo_url', c.photo_url));
end $function$;

create or replace function public.customer_update_profile(p_name text, p_phone text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare c customers; clean text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10); cid uuid := my_customer_id();
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(p_name) > 80 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo','Enter your name'));
  end if;
  if length(clean) <> 10 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi 10-digit number daalo','Enter a valid 10-digit number'));
  end if;
  if exists (select 1 from customers where phone = clean and id is distinct from cid) then
    return jsonb_build_object('ok', false, 'msg', tr('Ye number kisi aur account se juda hai','This number belongs to another account'));
  end if;
  update customers set name = trim(p_name), phone = clean where id = cid returning * into c;
  if c.id is null then return jsonb_build_object('ok', false, 'msg', tr('Profile nahi mila','Profile not found')); end if;
  return jsonb_build_object('ok', true, 'msg', tr('Save ho gaya','Saved'), 'data', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone));
end $function$;

create or replace function public.my_lang()
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select lang from vendors   where auth_user_id = auth.uid()),
    (select lang from customers where id = my_customer_id()),
    'hi');
$function$;

create or replace function public.my_role()
 returns text language sql stable security definer set search_path to 'public'
as $function$
  select case
    when exists (select 1 from admins    where auth_user_id = auth.uid()) then 'admin'
    when exists (select 1 from vendors   where auth_user_id = auth.uid()) then 'vendor'
    when my_customer_id() is not null then 'customer'
    else 'none' end;
$function$;

create or replace function public.set_language(p_lang text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_lang not in ('hi','en') then
    return jsonb_build_object('ok', false, 'msg', 'Only hi or en');
  end if;
  update vendors   set lang = p_lang where auth_user_id = auth.uid();
  update customers set lang = p_lang where id = my_customer_id();
  return jsonb_build_object('ok', true, 'lang', p_lang,
    'msg', case when p_lang='en' then 'Language changed to English'
                else 'Bhasha Hindi ho gayi' end);
end $function$;

-- notifications are stored for the customer's primary auth user — every linked device reads those
create or replace function public.customer_notifications(p_limit integer default 40)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare uid uuid := coalesce(my_customer_uid(), auth.uid());
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Login', 'Login')); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'booking_id', n.booking_id, 'is_read', n.is_read, 'created_at', n.created_at,
      'title', n.title, 'title_en', coalesce(n.title_en, n.title), 'message', n.message, 'message_en', coalesce(n.message_en, n.message))
      order by n.created_at desc)
    from (select * from notifications where user_id = uid and role = 'customer'
          order by created_at desc limit least(greatest(p_limit, 1), 100)) n), '[]'::jsonb));
end $function$;

create or replace function public.customer_mark_read(p_id uuid default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare uid uuid := coalesce(my_customer_uid(), auth.uid());
begin
  update notifications set is_read = true, read_at = coalesce(read_at, now())
   where user_id = uid and role = 'customer' and not is_read and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $function$;

-- a customer's devices all subscribe under the primary auth user, so a push reaches every device
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text default null, p_auth text default null, p_agent text default null, p_role text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare r text; uid uuid := auth.uid();
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  r := case
         when p_role = 'customer' and my_customer_id() is not null then 'customer'
         when p_role = 'vendor'   and my_vendor_id()   is not null then 'vendor'
         else coalesce(nullif(my_role(), 'none'), 'customer') end;
  if r = 'customer' then uid := coalesce(my_customer_uid(), auth.uid()); end if;
  insert into push_subscriptions(user_id, role, endpoint, p256dh, auth_key, user_agent)
  values (uid, r, p_endpoint, p_p256dh, p_auth, p_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, role = excluded.role,
        p256dh = coalesce(excluded.p256dh, push_subscriptions.p256dh),
        auth_key = coalesce(excluded.auth_key, push_subscriptions.auth_key),
        user_agent = coalesce(excluded.user_agent, push_subscriptions.user_agent),
        is_active = true, last_seen = now();
  return jsonb_build_object('ok', true, 'msg', tr('Alerts chalu','Alerts on'), 'role', r);
end $function$;

-- ---------- the shared basket ----------
create or replace function public.cart_json(c customer_carts)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'items', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(c.items,'{}'::jsonb)) e(k, v)
                        where exists (select 1 from products p where p.id::text = e.k)), '{}'::jsonb),
    'vendor_id', c.vendor_id, 'rev', coalesce(c.rev, 0), 'updated_at', c.updated_at);
$function$;
revoke execute on function public.cart_json(customer_carts) from public, anon, authenticated;

create or replace function public.customer_cart_get()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); c customer_carts;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  select * into c from customer_carts where customer_id = cid;
  if c.customer_id is null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('items', '{}'::jsonb, 'vendor_id', null, 'rev', 0, 'updated_at', null));
  end if;
  return jsonb_build_object('ok', true, 'data', cart_json(c));
end $function$;

-- p_changes = { "<product uuid>": qty } — absolute quantities, 0 (or less) removes the item.
-- p_clear = start from an empty basket (after a booking). Unknown products are ignored.
create or replace function public.customer_cart_apply(p_changes jsonb default '{}'::jsonb, p_vendor uuid default null, p_clear boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare cid uuid := my_customer_id(); cur jsonb; k text; v jsonb; q int; c customer_carts; vend uuid;
begin
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if p_changes is not null and jsonb_typeof(p_changes) <> 'object' then
    return jsonb_build_object('ok', false, 'msg', tr('Kuch galat hua','Something went wrong'));
  end if;
  if (select count(*) from jsonb_object_keys(coalesce(p_changes,'{}'::jsonb))) > 100 then
    return jsonb_build_object('ok', false, 'msg', tr('Kuch galat hua','Something went wrong'));
  end if;
  insert into customer_carts (customer_id) values (cid) on conflict (customer_id) do nothing;
  select * into c from customer_carts where customer_id = cid for update;
  cur := case when p_clear then '{}'::jsonb else coalesce(c.items, '{}'::jsonb) end;
  for k, v in select * from jsonb_each(coalesce(p_changes, '{}'::jsonb)) loop
    if k !~ '^[0-9a-fA-F-]{36}$' then continue; end if;
    begin q := floor((v #>> '{}')::numeric)::int; exception when others then continue; end;
    if q <= 0 then
      cur := cur - k;
    elsif exists (select 1 from products where id = k::uuid) then
      cur := cur || jsonb_build_object(k, least(q, 99));
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(cur)) > 80 then
    return jsonb_build_object('ok', false, 'msg', tr('Tokri bahut bhari hai','Your basket is too full'));
  end if;
  if cur = '{}'::jsonb then vend := null;
  elsif p_vendor is not null and exists (select 1 from vendors where id = p_vendor) then vend := p_vendor;
  else vend := c.vendor_id; end if;
  update customer_carts set items = cur, vendor_id = vend, rev = rev + 1, updated_at = now()
   where customer_id = cid returning * into c;
  return jsonb_build_object('ok', true, 'data', cart_json(c));
end $function$;

revoke execute on function public.customer_cart_get() from public, anon;
revoke execute on function public.customer_cart_apply(jsonb, uuid, boolean) from public, anon;
grant execute on function public.customer_cart_get() to authenticated;
grant execute on function public.customer_cart_apply(jsonb, uuid, boolean) to authenticated;
