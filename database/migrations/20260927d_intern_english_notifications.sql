-- Interns use the staff site in English: task notifications (in-app + push) go to them in English.
-- Sales staff keep the Hinglish text. Same signatures → no overloads.
create or replace function public.admin_add_task(p_staff uuid[], p_title text, p_details text default null::text,
  p_priority text default 'normal'::text, p_due date default null::date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare sid uuid; n int := 0; s staff; pr text := coalesce(nullif(p_priority, ''), 'normal'); en boolean;
begin
  perform admin_guard();
  if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Kaam ka title likho'); end if;
  if coalesce(array_length(p_staff, 1), 0) = 0 then return jsonb_build_object('ok', false, 'msg', 'Kam se kam ek staff chuno'); end if;
  if pr not in ('low', 'normal', 'high') then pr := 'normal'; end if;
  foreach sid in array p_staff loop
    select * into s from staff where id = sid and is_active;
    continue when s.id is null;
    en := s.kind = 'intern';
    insert into staff_tasks (staff_id, title, details, priority, due_date, created_by)
    values (sid, trim(p_title), nullif(trim(coalesce(p_details, '')), ''), pr, p_due, auth.uid());
    perform team_notify(s.auth_user_id, 'staff', 'task_new',
      case when en then (case when pr = 'high' then '🔴 New urgent task' else '📝 New task for you' end)
           else (case when pr = 'high' then '🔴 Naya zaroori kaam' else '📝 Naya kaam mila' end) end,
      trim(p_title) || coalesce(case when en then ' — due ' || to_char(p_due, 'DD Mon') else ' — ' || to_char(p_due, 'DD Mon') || ' tak' end, ''));
    n := n + 1;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'msg', 'Koi chalu staff nahi mila'); end if;
  return jsonb_build_object('ok', true, 'msg', n || ' logon ko kaam de diya — unhe notification gaya');
end $function$;

create or replace function public.admin_reopen_task(p_task uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare t staff_tasks; s staff;
begin
  perform admin_guard();
  update staff_tasks set status = 'todo', completed_at = null, updated_at = now() where id = p_task returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  select * into s from staff where id = t.staff_id;
  perform team_notify(s.auth_user_id, 'staff', 'task_reopen',
    case when s.kind = 'intern' then '↩️ Task reopened' else '↩️ Kaam dobara khula' end, t.title);
  return jsonb_build_object('ok', true, 'msg', 'Kaam dobara khul gaya');
end $function$;
