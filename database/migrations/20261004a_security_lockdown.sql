-- 2026-10-04 · Security lockdown (audit of the live customer + vendor sites)
--
-- 1. No direct table access from the browser. Every site calls SECURITY DEFINER RPCs only
--    (checked: no .from('table') anywhere in customer/, vendor-site/, vendor/, staff-site/,
--    admin-site/, platform/apps/api). But anon/authenticated still had INSERT/UPDATE/DELETE/
--    TRUNCATE on every table, and the RLS policies only checked "is it yours", not "is this
--    change allowed". Because anonymous sign-ins are on (customer phone login), "authenticated"
--    includes every visitor. Concretely, through /rest/v1/<table>:
--      - a vendor could set vendors.status = 'approved' or products.review_status = 'approved',
--        or bookings.status = 'delivered' without the delivery code;
--      - anyone could insert an already-approved vendor row;
--      - a customer could change status / totals on their booking or delete a payment row;
--      - vendors' phone + auth ids were readable by anyone (approved vendors).
--    Fix: revoke every table/view/sequence privilege from anon + authenticated (also for future
--    tables). RLS stays on as a second wall.
-- 2. Order-state rules the RPCs were missing: vendor status changes only move forward, vendor
--    cancel only before the bill, OTP-issue only after the bill, customer dispute only on a bill,
--    payment amount and bill lines must be sane, a bill can only add the vendor's own products.
-- 3. customer_update_profile validates the number and refuses one that belongs to someone else.
-- 4. maps_url (any address' GPS by id) is internal only.
-- 5. send-push accepted any caller: push_note now sends a shared secret (app_settings.push_secret)
--    and the edge function rejects requests without it.
-- 6. admin_add_vendor runs as definer (it relied on table grants; admin_guard() still first).

-- helper: patch a function body with a regex (whitespace-insensitive) and fail loudly if nothing matched
create or replace function pg_temp.rb_patch(p_fn regprocedure, p_pat text, p_rep text) returns void
language plpgsql as $$
declare d text; nd text;
begin
  d := pg_get_functiondef(p_fn);
  nd := regexp_replace(d, p_pat, p_rep);
  if nd = d then raise exception 'rb_patch: pattern not found in %', p_fn; end if;
  execute nd;
end $$;

-- ---------- 1. table privileges ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

alter function public.admin_add_vendor(text,text,vendor_type,text[],text,text,integer) security definer;
alter function public.slot_label(time_slot,text) set search_path = public, pg_temp;

-- ---------- 4. internal-only helper ----------
revoke execute on function public.maps_url(uuid,text) from public, anon, authenticated;

-- ---------- 2. order-state rules ----------
select pg_temp.rb_patch('public.vendor_set_status(uuid,booking_status)'::regprocedure,
  'update\s+bookings\s+set\s+status\s*=\s*p_status\s+where\s+id\s*=\s*p_booking\s*;',
  $r$if bk.status = p_status then
    return jsonb_build_object('ok', true, 'msg', tr('Pehle hi ho chuka hai','Already done'), 'maps_url', maps_url(bk.address_id));
  end if;
  if (p_status = 'on_the_way' and bk.status <> 'placed')
     or (p_status = 'reached' and bk.status not in ('placed','on_the_way')) then
    return jsonb_build_object('ok', false, 'msg', tr('Is order ka status ab ye nahi ho sakta','This order can no longer move to that status'));
  end if;
  update bookings set status = p_status where id = p_booking;$r$);

select pg_temp.rb_patch('public.vendor_cancel_booking(uuid,text)'::regprocedure,
  '(update\s+bookings\s+set\s+status\s*=\s*''cancelled'')',
  $r$if bk.status not in ('placed','on_the_way','reached') then
    return jsonb_build_object('ok', false, 'msg', tr('Bill ke baad order cancel nahi hota — admin se baat karo','An order cannot be cancelled after the bill — please contact admin'));
  end if;
  \1$r$);

select pg_temp.rb_patch('public.vendor_report_otp_issue(uuid,text)'::regprocedure,
  '(update\s+bookings\s+set\s+status\s*=\s*''pending_review'')',
  $r$if bk.status not in ('bill_final','bill_approved','paid') then
    return jsonb_build_object('ok', false, 'msg', tr('Ye sirf bill ke baad hota hai','This is only possible after the bill'));
  end if;
  \1$r$);

select pg_temp.rb_patch('public.customer_dispute_bill(uuid,text)'::regprocedure,
  '(update\s+bookings\s+set\s+status\s*=\s*''disputed'')',
  $r$if bk.status not in ('bill_final','bill_approved') then
    return jsonb_build_object('ok', false, 'msg', tr('Bill aane ke baad hi shikayat kar sakte ho','You can only report a problem once the bill is ready'));
  end if;
  \1$r$);

select pg_temp.rb_patch('public.vendor_record_payment(uuid,pay_method,numeric)'::regprocedure,
  '(insert\s+into\s+payments\s*\()',
  $r$if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi rakam daalo','Enter a valid amount'));
  end if;
  \1$r$);

select pg_temp.rb_patch('public.vendor_finalize_bill(uuid,jsonb)'::regprocedure,
  '(for\s+it\s+in\s+select\s+\*\s+from\s+jsonb_array_elements\(p_items\)\s+loop)',
  $r$if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or exists (
       select 1 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e
       where coalesce((e->>'final_qty')::numeric, 0) < 0 or coalesce((e->>'final_qty')::numeric, 0) > 1000
          or coalesce((e->>'final_price')::numeric, 0) < 0 or coalesce((e->>'final_price')::numeric, 0) > 100000) then
    return jsonb_build_object('ok', false, 'msg', tr('Matra ya rate galat hai','A quantity or rate is not valid'));
  end if;
  \1$r$);

select pg_temp.rb_patch('public.vendor_finalize_bill(uuid,jsonb)'::regprocedure,
  'select\s+\*\s+into\s+prod\s+from\s+products\s+where\s+id\s*=\s*\(it->>''product_id''\)::uuid\s*;',
  $r$select * into prod from products where id = (it->>'product_id')::uuid and vendor_id = bk.vendor_id;$r$);

-- ---------- 3. profile ----------
create or replace function public.customer_update_profile(p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c customers; clean text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10);
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(p_name) > 80 then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo','Enter your name'));
  end if;
  if length(clean) <> 10 then
    return jsonb_build_object('ok', false, 'msg', tr('Sahi 10-digit number daalo','Enter a valid 10-digit number'));
  end if;
  if exists (select 1 from customers where phone = clean and auth_user_id is distinct from auth.uid()) then
    return jsonb_build_object('ok', false, 'msg', tr('Ye number kisi aur account se juda hai','This number belongs to another account'));
  end if;
  update customers set name = trim(p_name), phone = clean where auth_user_id = auth.uid() returning * into c;
  if c.id is null then return jsonb_build_object('ok', false, 'msg', tr('Profile nahi mila','Profile not found')); end if;
  return jsonb_build_object('ok', true, 'msg', tr('Save ho gaya','Saved'), 'data', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone));
end $$;
revoke execute on function public.customer_update_profile(text,text) from public, anon;
grant execute on function public.customer_update_profile(text,text) to authenticated;

-- ---------- 5. push secret ----------
insert into app_settings(key, value)
values ('push_secret', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
on conflict (key) do nothing;

select pg_temp.rb_patch('public.push_note(uuid)'::regprocedure,
  'headers\s*:=\s*''\{"Content-Type":"application/json"\}''::jsonb',
  $r$headers := jsonb_build_object('Content-Type', 'application/json',
                   'x-rb-push-secret', (select value #>> '{}' from app_settings where key = 'push_secret'))$r$);
