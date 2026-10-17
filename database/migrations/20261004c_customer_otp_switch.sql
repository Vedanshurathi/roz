-- 2026-10-04 · Customer SMS OTP login, behind a switch (off until an SMS provider is set up)
--
-- Phone login had no OTP by design (whoever types a number owns that account). Vedanshu asked
-- for OTP. Supabase sends the SMS itself (Auth → Providers → Phone, with MSG91 / Twilio /
-- Vonage / MessageBird), so nothing here talks to an SMS company:
--   - app_settings.customer_otp (false) — admin turns it on (admin_set_customer_otp) only after
--     the Phone provider works, otherwise nobody could log in by phone.
--   - customer_login_config() (anon) — tells the customer site whether to ask for a code.
--   - customer_phone_login: when the switch is on, the session must be a phone-verified Supabase
--     user whose phone is this number (auth.users.phone = '91' || number, set by verifyOtp).
--     An anonymous session gets code OTP_REQUIRED. Checked in the DB, not just the page.

insert into app_settings(key, value) values ('customer_otp', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.customer_otp_on() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value #>> '{}')::boolean from app_settings where key = 'customer_otp'), false)
$$;
revoke execute on function public.customer_otp_on() from public, anon, authenticated;

create or replace function public.customer_login_config() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('ok', true, 'data', jsonb_build_object('otp', customer_otp_on()))
$$;
revoke execute on function public.customer_login_config() from public;
grant execute on function public.customer_login_config() to anon, authenticated;

create or replace function public.admin_set_customer_otp(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  insert into app_settings(key, value, updated_at, updated_by) values ('customer_otp', to_jsonb(coalesce(p_on,false)), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('otp', coalesce(p_on,false)));
end $$;
revoke execute on function public.admin_set_customer_otp(boolean) from public, anon;
grant execute on function public.admin_set_customer_otp(boolean) to authenticated;

create or replace function public.admin_settings() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform admin_guard();
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'commission_rate', commission_rate(),
    'commission_updated_at', (select updated_at from app_settings where key = 'commission_rate'),
    'customer_otp', customer_otp_on()));
end $$;

do $$
declare d text; nd text;
begin
  d := pg_get_functiondef('public.customer_phone_login(text,text)'::regprocedure);
  nd := regexp_replace(d,
    '(if\s+length\(trim\(coalesce\(p_name,''''\)\)\)\s*<\s*1\s+then)',
    $r$if customer_otp_on() and coalesce((select phone from auth.users where id = auth.uid()), '') <> '91' || clean_phone then
    return jsonb_build_object('ok', false, 'code', 'OTP_REQUIRED', 'msg', tr('Pehle SMS wala code daalo', 'Enter the code we sent by SMS first'));
  end if;
  \1$r$);
  if nd = d then raise exception 'customer_phone_login: pattern not found'; end if;
  execute nd;
end $$;

insert into msg_i18n(roman, hi, en)
select 'Pehle SMS wala code daalo', 'पहले SMS वाला कोड डालें', 'Enter the code we sent by SMS first'
where not exists (select 1 from msg_i18n where roman = 'Pehle SMS wala code daalo');
