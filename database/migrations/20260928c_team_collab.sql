-- Team collaboration (round 3):
--  * notifications can carry a url (push tap opens it) — meetings send the Google Meet link
--  * meetings: notification to every invited person + admins with time and Join link, "starting now" push,
--    admin can choose whether other admins are invited (with_admin no longer forced on for admins)
--  * shared tasks: task owner adds teammates (collaborators) — they see the task, change status, tick the
--    checklist, attach files and comment
--  * task comments (owner, collaborators, admins)
--  * files: share a file / link directly with teammates (shared_with); Storage read policy follows it
--  * team chat: one channel for the whole team (staff + admins), @name mentions notify

-- ---------- notifications with a link ----------
alter table notifications add column if not exists url text;

create or replace function public.push_note(p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n notifications; en boolean;
begin
  select * into n from notifications where id = p_id;
  if n.id is null or n.user_id is null then return; end if;
  en := person_lang(n.user_id) = 'en';
  perform net.http_post(
    url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('user_id', n.user_id, 'role', n.role, 'notification_id', n.id, 'url', n.url,
      'title', case when en then coalesce(n.title_en, n.title) else coalesce(n.title, n.title_en) end,
      'body',  case when en then coalesce(n.message_en, n.message) else coalesce(n.message, n.message_en) end));
exception when others then
  raise warning 'push_note: %', sqlerrm;
end $$;
revoke all on function public.push_note(uuid) from public, anon, authenticated;

create or replace function public.team_notify_url(p_user uuid, p_role text, p_type text, p_title text, p_msg text, p_url text)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare nid uuid;
begin
  if p_user is null then return; end if;
  insert into notifications (user_id, role, type, title, title_en, message, message_en, url)
  values (p_user, p_role, p_type, p_title, p_title, p_msg, p_msg, case when p_url ~* '^https://' then p_url end) returning id into nid;
  perform push_note(nid);
exception when others then
  raise warning 'team_notify_url failed: %', sqlerrm;
end $$;
revoke all on function public.team_notify_url(uuid,text,text,text,text,text) from public, anon, authenticated;

create or replace function public.team_notifications(p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare res jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', 'Login karo'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'type', n.type, 'title', coalesce(n.title_en, n.title),
      'message', coalesce(n.message_en, n.message), 'url', n.url, 'is_read', n.is_read, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
    into res
    from (select * from notifications where user_id = auth.uid() and role in ('staff', 'admin')
          order by created_at desc limit least(greatest(p_limit, 1), 100)) n;
  return jsonb_build_object('ok', true, 'data', res,
    'unread', (select count(*) from notifications where user_id = auth.uid() and role in ('staff', 'admin') and not is_read));
end $$;

-- ---------- meetings ----------
alter table staff_meetings add column if not exists start_notified boolean not null default false;

create or replace function public.meeting_when(m staff_meetings)
returns text language sql stable set search_path to 'public','pg_temp' as $$
  select to_char(m.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM') || ' IST · ' || m.duration_min || ' min';
$$;

create or replace function public.team_meeting_save(p_id uuid, p_title text, p_agenda text, p_starts timestamptz,
  p_duration int, p_link text, p_attendees uuid[], p_with_admin boolean default true, p_guests text[] default '{}')
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); m staff_meetings; who text; r uuid; att uuid[]; isnew boolean := p_id is null;
  msg text; g text[]; ttl text;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give the meeting a title'); end if;
  if p_starts is null then return jsonb_build_object('ok', false, 'msg', 'Pick a date and time'); end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  g := array(select distinct lower(trim(x)) from unnest(coalesce(p_guests, '{}')) x
             where trim(x) ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' limit 30);
  att := array(select distinct x from unnest(coalesce(p_attendees, '{}') || case when me is not null then array[me] else '{}' end) x
               where x in (select id from staff where is_active));
  who := coalesce((select name from staff where auth_user_id = auth.uid() limit 1), 'Admin');
  if isnew then
    insert into staff_meetings (title, agenda, starts_at, duration_min, meet_link, attendees, guest_emails, with_admin, created_by, created_by_name)
    values (left(trim(p_title),150), nullif(trim(coalesce(p_agenda,'')),''), p_starts, greatest(5, least(coalesce(p_duration,30), 480)),
            nullif(trim(coalesce(p_link,'')),''), att, g, coalesce(p_with_admin, true), auth.uid(), who)
    returning * into m;
  else
    update staff_meetings set title = left(trim(p_title),150), agenda = nullif(trim(coalesce(p_agenda,'')),''), starts_at = p_starts,
           duration_min = greatest(5, least(coalesce(p_duration,30), 480)), meet_link = nullif(trim(coalesce(p_link,'')),''),
           attendees = att, guest_emails = g, with_admin = coalesce(p_with_admin, true),
           reminded = case when starts_at <> p_starts then false else reminded end,
           start_notified = case when starts_at <> p_starts then false else start_notified end
     where id = p_id and (adm or created_by = auth.uid()) and status = 'scheduled' returning * into m;
    if m.id is null then return jsonb_build_object('ok', false, 'msg', 'Only the person who scheduled it can change it'); end if;
  end if;
  ttl := case when isnew then '📅 Meeting: ' else '📅 Meeting changed: ' end || m.title;
  msg := meeting_when(m) || ' · by ' || who || case when m.meet_link is not null then E'\nJoin: ' || m.meet_link else E'\nMeet link: not added yet' end;
  for r in select auth_user_id from staff where id = any(m.attendees) and auth_user_id is distinct from auth.uid() loop
    perform team_notify_url(r, 'staff', 'meeting', ttl, msg, m.meet_link);
  end loop;
  if m.with_admin then
    for r in select x from admin_user_ids() x where x is distinct from auth.uid() loop
      perform team_notify_url(r, 'admin', 'meeting', ttl, msg, m.meet_link);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'data', meeting_json(m));
end $$;

-- 15-minute heads-up + "starting now", both with the Join link
create or replace function public.rz_meeting_reminders()
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m staff_meetings; r uuid; msg text;
begin
  for m in select * from staff_meetings where status = 'scheduled' and not reminded
            and starts_at between now() + interval '5 minutes' and now() + interval '16 minutes' loop
    msg := meeting_when(m) || ' · ' || m.title || case when m.meet_link is not null then E'\nJoin: ' || m.meet_link else '' end;
    for r in select auth_user_id from staff where id = any(m.attendees) and is_active loop
      perform team_notify_url(r, 'staff', 'meeting', '⏰ Meeting in 15 minutes', msg, m.meet_link);
    end loop;
    if m.with_admin then
      for r in select admin_user_ids() loop perform team_notify_url(r, 'admin', 'meeting', '⏰ Meeting 15 min me', msg, m.meet_link); end loop;
    end if;
    update staff_meetings set reminded = true where id = m.id;
  end loop;
  for m in select * from staff_meetings where status = 'scheduled' and not start_notified
            and starts_at between now() - interval '5 minutes' and now() + interval '5 minutes' loop
    msg := m.title || case when m.meet_link is not null then E' — tap to join\n' || m.meet_link else '' end;
    for r in select auth_user_id from staff where id = any(m.attendees) and is_active loop
      perform team_notify_url(r, 'staff', 'meeting', '🎥 Meeting is starting now', msg, m.meet_link);
    end loop;
    if m.with_admin then
      for r in select admin_user_ids() loop perform team_notify_url(r, 'admin', 'meeting', '🎥 Meeting shuru ho rahi hai', msg, m.meet_link); end loop;
    end if;
    update staff_meetings set start_notified = true, reminded = true where id = m.id;
  end loop;
end $$;

-- ---------- shared tasks + comments ----------
alter table staff_tasks add column if not exists collaborators uuid[] not null default '{}';
create index if not exists staff_tasks_collab_idx on staff_tasks using gin (collaborators);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references staff_tasks(id) on delete cascade,
  author uuid,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table task_comments enable row level security;
create index if not exists task_comments_task_idx on task_comments(task_id, created_at);

-- can the current user work on this task? (owner, collaborator or admin)
create or replace function public.task_can(t staff_tasks)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select is_admin() or t.staff_id = my_staff_id() or my_staff_id() = any(t.collaborators);
$$;

create or replace function public.task_json(t staff_tasks)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', t.id, 'staff_id', t.staff_id, 'title', t.title, 'details', t.details,
    'priority', t.priority, 'due_date', t.due_date, 'status', t.status, 'staff_note', t.staff_note,
    'created_at', t.created_at, 'updated_at', t.updated_at, 'completed_at', t.completed_at,
    'source', t.source, 'category', t.category, 'link', t.link, 'checklist', t.checklist,
    'collaborators', t.collaborators,
    'collab_names', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb) from staff s where s.id = any(t.collaborators)),
    'owner_name', (select name from staff where id = t.staff_id),
    'owner', t.staff_id = my_staff_id(),
    'comments', (select count(*) from task_comments c where c.task_id = t.id),
    'last_comment_at', (select max(created_at) from task_comments c where c.task_id = t.id),
    'files', (select count(*) from staff_files f where f.task_id = t.id));
$$;

create or replace function public.staff_my_tasks()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); res jsonb;
begin
  if sid is null then return jsonb_build_object('ok', true, 'data', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(task_json(t) order by (t.status in ('todo','doing')) desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t where t.staff_id = sid or sid = any(t.collaborators);
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- the task's people other than me (auth user ids), for notifications
create or replace function public.task_people(t staff_tasks)
returns setof uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
  select auth_user_id from staff where (id = t.staff_id or id = any(t.collaborators)) and is_active
     and auth_user_id is distinct from auth.uid();
$$;

-- owner picks the teammates who work on the task with them (replaces the list)
create or replace function public.staff_task_share(p_id uuid, p_staff uuid[])
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); t staff_tasks; old uuid[]; nw uuid[]; r uuid; who text;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  select collaborators into old from staff_tasks where id = p_id and staff_id = sid;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only the task owner can add people'); end if;
  nw := array(select distinct x from unnest(coalesce(p_staff, '{}')) x where x <> sid and x in (select id from staff where is_active) limit 10);
  update staff_tasks set collaborators = nw, updated_at = now() where id = p_id returning * into t;
  select name into who from staff where id = sid;
  for r in select auth_user_id from staff where id = any(nw) and not (id = any(old)) loop
    perform team_notify(r, 'staff', 'task_shared', '🤝 ' || who || ' added you to a task', t.title);
  end loop;
  return jsonb_build_object('ok', true, 'data', task_json(t));
end $$;

-- status: owner or collaborator. Admin told for admin tasks; the other people on the task told on done / not done
create or replace function public.staff_set_task_status(p_task uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); t staff_tasks; who text; r uuid;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Ye account staff ka nahi hai'); end if;
  if p_status not in ('todo', 'doing', 'done', 'not_done') then return jsonb_build_object('ok', false, 'msg', 'Galat status'); end if;
  if p_status = 'not_done' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'msg', 'Kyun nahi hua — thoda likho');
  end if;
  update staff_tasks set status = p_status, staff_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), staff_note),
         completed_at = case when p_status = 'done' then now() else null end, updated_at = now()
   where id = p_task and (staff_id = sid or sid = any(collaborators)) returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  select name into who from staff where id = sid;
  if p_status in ('done', 'not_done') and t.source = 'admin' then
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'task_' || p_status,
        case when p_status = 'done' then '✅ ' || who || ' ne kaam pura kiya' else '⚠️ ' || who || ': kaam nahi hua' end,
        t.title || coalesce(' — ' || t.staff_note, ''));
    end loop;
  end if;
  if p_status in ('done', 'not_done') then
    for r in select task_people(t) loop
      perform team_notify(r, 'staff', 'task_' || p_status,
        case when p_status = 'done' then '✅ ' || who || ' finished a shared task' else '⚠️ ' || who || ': shared task not done' end, t.title);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', case p_status when 'done' then 'Shabaash! Kaam complete ✓'
                                                             when 'not_done' then 'Admin ko bata diya'
                                                             when 'doing' then 'Kaam chalu' else 'Kaam wapas baaki me' end);
end $$;

create or replace function public.staff_task_checklist(p_id uuid, p_checklist jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); t staff_tasks; cl jsonb;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if jsonb_typeof(coalesce(p_checklist,'[]'::jsonb)) <> 'array' then return jsonb_build_object('ok', false, 'msg', 'Bad checklist'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('t', left(trim(e->>'t'), 200), 'd', coalesce((e->>'d')::boolean, false))), '[]'::jsonb)
    into cl from (select e from jsonb_array_elements(p_checklist) e where coalesce(trim(e->>'t'),'') <> '' limit 50) x;
  update staff_tasks set checklist = cl, updated_at = now() where id = p_id and (staff_id = sid or sid = any(collaborators)) returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Task not found'); end if;
  return jsonb_build_object('ok', true, 'data', task_json(t));
end $$;

create or replace function public.task_comments_list(p_task uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare t staff_tasks;
begin
  select * into t from staff_tasks where id = p_task;
  if t.id is null or not task_can(t) then return jsonb_build_object('ok', false, 'msg', 'Task not found'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'author_name', c.author_name, 'body', c.body,
    'created_at', c.created_at, 'mine', c.author = auth.uid()) order by c.created_at) from task_comments c where c.task_id = p_task), '[]'::jsonb));
end $$;

create or replace function public.task_comment_add(p_task uuid, p_body text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare t staff_tasks; c task_comments; who text := team_who(); r uuid;
begin
  select * into t from staff_tasks where id = p_task;
  if t.id is null or not task_can(t) then return jsonb_build_object('ok', false, 'msg', 'Task not found'); end if;
  if coalesce(trim(p_body),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Write something'); end if;
  insert into task_comments (task_id, author, author_name, body) values (p_task, auth.uid(), who, left(trim(p_body), 2000)) returning * into c;
  for r in select task_people(t) loop
    perform team_notify(r, 'staff', 'task_comment', '💬 ' || who || ' on “' || left(t.title, 60) || '”', left(c.body, 180));
  end loop;
  if t.source = 'admin' and not is_admin() then
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'task_comment', '💬 ' || who || ' · ' || left(t.title, 60), left(c.body, 180));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', c.id, 'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at, 'mine', true));
end $$;

create or replace function public.task_comment_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  delete from task_comments where id = p_id and (author = auth.uid() or is_admin());
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only your own comments'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- files shared with teammates ----------
alter table staff_files add column if not exists shared_with uuid[] not null default '{}';
create index if not exists staff_files_shared_idx on staff_files using gin (shared_with);

create or replace function public.file_json(f staff_files)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', f.id, 'staff_id', f.staff_id, 'kind', f.kind, 'name', f.name, 'path', f.path,
    'url', f.url, 'size', f.size, 'mime', f.mime, 'task_id', f.task_id,
    'task_title', (select title from staff_tasks where id = f.task_id), 'note', f.note,
    'from_admin', f.from_admin, 'uploader_name', f.uploader_name, 'created_at', f.created_at,
    'shared_with', f.shared_with, 'mine', f.uploaded_by = auth.uid(),
    'shared_names', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb) from staff s where s.id = any(f.shared_with)));
$$;

-- a teammate may read a file object when it is shared with them or attached to a task they work on
create or replace function public.can_read_staff_file(p_path text)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from staff_files f left join staff_tasks t on t.id = f.task_id
    where f.path = p_path and my_staff_id() is not null
      and (my_staff_id() = any(f.shared_with) or (t.id is not null and (t.staff_id = my_staff_id() or my_staff_id() = any(t.collaborators)))));
$$;
grant execute on function public.can_read_staff_file(text) to authenticated;

drop policy if exists "staff-files read" on storage.objects;
create policy "staff-files read" on storage.objects for select to authenticated
  using (bucket_id = 'staff-files' and ((storage.foldername(name))[1] = my_staff_id()::text or is_admin() or can_read_staff_file(name)));

create or replace function public.team_file_add(p_staff uuid, p_kind text, p_name text, p_path text default null,
  p_url text default null, p_size bigint default null, p_mime text default null, p_task uuid default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); target uuid; f staff_files; who text; r uuid; t staff_tasks;
begin
  target := case when adm and p_staff is not null then p_staff else me end;
  if target is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if not adm and target <> me then return jsonb_build_object('ok', false, 'msg', 'Not allowed'); end if;
  if coalesce(p_kind,'') not in ('file','link') then return jsonb_build_object('ok', false, 'msg', 'Bad type'); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give it a name'); end if;
  if p_kind = 'file' and (p_path is null or split_part(p_path, '/', 1) <> target::text) then
    return jsonb_build_object('ok', false, 'msg', 'Bad file path'); end if;
  if p_kind = 'link' then
    if coalesce(trim(p_url),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Paste the link'); end if;
    if trim(p_url) !~* '^https?://' then p_url := 'https://' || trim(p_url); end if;
  end if;
  if p_task is not null then
    select * into t from staff_tasks where id = p_task and (staff_id = target or target = any(collaborators));
    if t.id is null then p_task := null; end if;
  end if;
  who := coalesce((select name from staff where auth_user_id = auth.uid() limit 1), 'Admin');
  insert into staff_files (staff_id, kind, name, path, url, size, mime, task_id, note, from_admin, uploaded_by, uploader_name)
  values (target, p_kind, left(trim(p_name), 200), case when p_kind = 'file' then p_path end,
          case when p_kind = 'link' then trim(p_url) end, p_size, p_mime, p_task, nullif(trim(coalesce(p_note,'')), ''),
          adm and target is distinct from me, auth.uid(), who)
  returning * into f;
  if f.from_admin then
    perform team_notify((select auth_user_id from staff where id = target), 'staff', 'file_shared',
      case when p_kind = 'file' then '📎 New file from the admin' else '🔗 New link from the admin' end, f.name);
  else
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'file_shared',
        (case when p_kind = 'file' then '📎 ' else '🔗 ' end) || who || ' ne share kiya', f.name);
    end loop;
    if t.id is not null then
      for r in select task_people(t) loop
        perform team_notify(r, 'staff', 'file_shared', '📎 ' || who || ' added a file to “' || left(t.title, 60) || '”', f.name);
      end loop;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'data', file_json(f));
end $$;

-- uploader (or admin) chooses the teammates who can see it (replaces the list)
create or replace function public.team_file_share(p_id uuid, p_staff uuid[])
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare f staff_files; old uuid[]; nw uuid[]; r uuid; who text := team_who();
begin
  select shared_with into old from staff_files where id = p_id and (uploaded_by = auth.uid() or is_admin());
  if not found then return jsonb_build_object('ok', false, 'msg', 'You can only share what you uploaded'); end if;
  nw := array(select distinct x from unnest(coalesce(p_staff, '{}')) x where x in (select id from staff where is_active)
              and x is distinct from my_staff_id() limit 20);
  update staff_files set shared_with = nw where id = p_id returning * into f;
  for r in select auth_user_id from staff where id = any(nw) and not (id = any(old)) loop
    perform team_notify(r, 'staff', 'file_shared', (case when f.kind = 'file' then '📎 ' else '🔗 ' end) || who || ' shared with you', f.name);
  end loop;
  return jsonb_build_object('ok', true, 'data', file_json(f));
end $$;

create or replace function public.team_files(p_staff uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); res jsonb;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  select coalesce(jsonb_agg(file_json(f) || jsonb_build_object('staff_name', s.name) order by f.created_at desc), '[]'::jsonb)
    into res from staff_files f join staff s on s.id = f.staff_id
   where case when adm then (p_staff is null or f.staff_id = p_staff)
              else f.staff_id = me or me = any(f.shared_with)
                   or exists (select 1 from staff_tasks t where t.id = f.task_id and (t.staff_id = me or me = any(t.collaborators))) end;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- ---------- team chat ----------
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  author uuid,
  author_name text,
  author_kind text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table team_messages enable row level security;
create index if not exists team_messages_created_idx on team_messages(created_at desc);

create or replace function public.team_chat(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author_name', m.author_name,
      'author_kind', m.author_kind, 'body', m.body, 'created_at', m.created_at, 'mine', m.author = auth.uid()) order by m.created_at)
    from (select * from team_messages order by created_at desc limit least(greatest(coalesce(p_limit,100), 1), 300)) m), '[]'::jsonb));
end $$;

-- @Name (first name) or @admin / @all mention → notification
create or replace function public.team_chat_send(p_body text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m team_messages; who text := team_who(); k text; r uuid; tags text[]; body text := left(trim(coalesce(p_body,'')), 2000);
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if body = '' then return jsonb_build_object('ok', false, 'msg', 'Write a message'); end if;
  k := case when is_admin() and my_staff_id() is null then 'admin' else coalesce((select kind from staff where auth_user_id = auth.uid() limit 1), 'admin') end;
  insert into team_messages (author, author_name, author_kind, body) values (auth.uid(), who, k, body) returning * into m;
  tags := array(select distinct lower(x[1]) from regexp_matches(body, '@([A-Za-zऀ-ॿ]+)', 'g') x);
  if array_length(tags, 1) > 0 then
    for r in select distinct auth_user_id from staff where is_active and auth_user_id is distinct from auth.uid()
               and (lower(split_part(trim(name), ' ', 1)) = any(tags) or 'all' = any(tags)) loop
      perform team_notify(r, 'staff', 'chat_mention', '💬 ' || who || ' mentioned you', left(body, 180));
    end loop;
    if 'admin' = any(tags) or 'all' = any(tags) then
      for r in select x from admin_user_ids() x where x is distinct from auth.uid() loop
        perform team_notify(r, 'admin', 'chat_mention', '💬 ' || who || ' (team chat)', left(body, 180));
      end loop;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', m.id, 'author_name', m.author_name, 'author_kind', m.author_kind,
    'body', m.body, 'created_at', m.created_at, 'mine', true));
end $$;

create or replace function public.team_chat_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  delete from team_messages where id = p_id and (author = auth.uid() or is_admin());
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only your own messages'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- grants ----------
do $$ declare f text; begin
  foreach f in array array['task_can(staff_tasks)','task_people(staff_tasks)','meeting_when(staff_meetings)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['staff_task_share(uuid,uuid[])','task_comments_list(uuid)','task_comment_add(uuid,text)','task_comment_delete(uuid)',
    'team_file_share(uuid,uuid[])','team_chat(int)','team_chat_send(text)','team_chat_delete(uuid)',
    'team_meeting_save(uuid,text,text,timestamptz,int,text,uuid[],boolean,text[])','staff_set_task_status(uuid,text,text)',
    'staff_task_checklist(uuid,jsonb)','team_file_add(uuid,text,text,text,text,bigint,text,uuid,text)','team_files(uuid)',
    'staff_my_tasks()','team_notifications(int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
