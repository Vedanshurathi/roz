-- 1. Customer push never reached a phone when the same Google account is also an admin
--    or vendor: save_push_subscription stored role = my_role() ('admin' wins over
--    'customer'), and send-push looks for role = 'customer'. The app now says which app
--    is subscribing (p_role); the role is only accepted if the person really has it.
--    On a re-subscribe the row's role / keys are refreshed too.
-- 2. customer_save_address: `if a is null` on a composite row is unreliable (lesson 4) —
--    use a.id. The customer app now calls this on "Save address" (editing = update).
drop function if exists public.save_push_subscription(text, text, text, text);
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text default null,
  p_auth text default null, p_agent text default null, p_role text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  r := case
         when p_role = 'customer' and my_customer_id() is not null then 'customer'
         when p_role = 'vendor'   and my_vendor_id()   is not null then 'vendor'
         else coalesce(nullif(my_role(), 'none'), 'customer') end;
  insert into push_subscriptions(user_id, role, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), r, p_endpoint, p_p256dh, p_auth, p_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, role = excluded.role,
        p256dh = coalesce(excluded.p256dh, push_subscriptions.p256dh),
        auth_key = coalesce(excluded.auth_key, push_subscriptions.auth_key),
        user_agent = coalesce(excluded.user_agent, push_subscriptions.user_agent),
        is_active = true, last_seen = now();
  return jsonb_build_object('ok', true, 'msg', tr('Alerts chalu','Alerts on'), 'role', r);
end $$;
revoke all on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

create or replace function public.customer_save_address(p_label text, p_house text, p_street text, p_landmark text,
  p_area text, p_lat double precision default null, p_lng double precision default null,
  p_make_default boolean default true, p_address_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid; a addresses;
begin
  cid := my_customer_id();
  if cid is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if coalesce(trim(p_area),'') = '' then
    return jsonb_build_object('ok', false, 'msg', tr('Gaon chuno','Choose your village'));
  end if;
  if p_address_id is null then
    insert into addresses (customer_id,label,house_no,street,landmark,area,lat,lng)
    values (cid,p_label,p_house,p_street,p_landmark,p_area,p_lat,p_lng)
    returning * into a;
  else
    update addresses
       set label=p_label, house_no=p_house, street=p_street,
           landmark=p_landmark, area=p_area, lat=p_lat, lng=p_lng
     where id=p_address_id and customer_id=cid returning * into a;
    if a.id is null then   -- not theirs / deleted: save as a new address instead of failing
      insert into addresses (customer_id,label,house_no,street,landmark,area,lat,lng)
      values (cid,p_label,p_house,p_street,p_landmark,p_area,p_lat,p_lng)
      returning * into a;
    end if;
  end if;
  if p_make_default then
    update addresses set is_default = (id = a.id) where customer_id = cid;
  end if;
  return jsonb_build_object('ok', true, 'msg', tr('Address save ho gaya','Address saved'), 'data', to_jsonb(a));
end $$;
