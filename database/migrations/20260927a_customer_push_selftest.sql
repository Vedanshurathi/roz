-- Customer "Check notifications" tool (My account): send yourself a test push and read back what
-- happened to it (how many phones, sent / failed, delivered, opened). Max one test per 30 s.
create or replace function public.customer_test_push()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare nid uuid; devs int;
begin
  if auth.uid() is null or my_customer_id() is null then
    return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first'));
  end if;
  if exists (select 1 from notifications where user_id = auth.uid() and type = 'test'
             and created_at > now() - interval '30 seconds') then
    return jsonb_build_object('ok', false, 'msg', tr('30 second ruk kar dobara try karo','Wait 30 seconds and try again'));
  end if;
  select count(*) into devs from push_subscriptions
   where user_id = auth.uid() and role = 'customer' and is_active and p256dh is not null and auth_key is not null;
  insert into notifications (user_id, role, type, title, title_en, message, message_en)
  values (auth.uid(), 'customer', 'test', 'टेस्ट सूचना ✅', 'Test notification ✅',
          'अगर यह फ़ोन पर दिखी, तो सूचनाएँ ठीक काम कर रही हैं।', 'If you can see this on your phone, notifications work.')
  returning id into nid;
  perform push_note(nid);
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', nid, 'devices', devs));
end $$;

create or replace function public.customer_test_push_status(p_id uuid)
returns jsonb language sql security definer set search_path to 'public','pg_temp' as $$
  select coalesce((select jsonb_build_object('ok', true, 'data', jsonb_build_object(
            'devices', push_devices, 'sent', push_sent, 'failed', push_failed, 'push_at', push_at,
            'delivered_at', delivered_at, 'opened_at', opened_at))
          from notifications where id = p_id and user_id = auth.uid()),
         jsonb_build_object('ok', false, 'msg', 'not found'));
$$;

revoke all on function public.customer_test_push() from public, anon;
revoke all on function public.customer_test_push_status(uuid) from public, anon;
grant execute on function public.customer_test_push() to authenticated;
grant execute on function public.customer_test_push_status(uuid) to authenticated;
