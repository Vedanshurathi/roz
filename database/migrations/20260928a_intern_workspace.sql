-- Intern workspace (staff site): interns keep their OWN to-do sheet (admin can add to it too),
-- share files and links, schedule Google Meet meetings, and send a daily report. Admin sees all of it.
-- Everything is RPC-only (RLS on, no table policies); files live in the private Storage bucket
-- `staff-files` under <staff_id>/…, readable only by that staff member and admins.

-- ---------- tasks: own tasks, "doing", category, link ----------
alter table staff_tasks add column if not exists source text not null default 'admin';
alter table staff_tasks add column if not exists category text;
alter table staff_tasks add column if not exists link text;
alter table staff_tasks drop constraint if exists staff_tasks_status_check;
alter table staff_tasks add constraint staff_tasks_status_check check (status in ('todo','doing','done','not_done'));
alter table staff_tasks drop constraint if exists staff_tasks_source_check;
alter table staff_tasks add constraint staff_tasks_source_check check (source in ('admin','self'));

-- files table first: task_json() counts a task's files
create table if not exists staff_files (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  kind text not null default 'file' check (kind in ('file','link')),
  name text not null,
  path text,                    -- storage path in bucket staff-files (kind = file)
  url text,                     -- kind = link
  size bigint,
  mime text,
  task_id uuid references staff_tasks(id) on delete set null,
  note text,
  from_admin boolean not null default false,
  uploaded_by uuid,
  uploader_name text,
  created_at timestamptz not null default now()
);
alter table staff_files enable row level security;
create index if not exists staff_files_staff_idx on staff_files(staff_id, created_at desc);

create or replace function public.my_intern_id()
returns uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
  select id from staff where auth_user_id = auth.uid() and is_active and kind = 'intern';
$$;

create or replace function public.admin_user_ids()
returns setof uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
  select auth_user_id from admins where auth_user_id is not null;
$$;

create or replace function public.task_json(t staff_tasks)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', t.id, 'staff_id', t.staff_id, 'title', t.title, 'details', t.details,
    'priority', t.priority, 'due_date', t.due_date, 'status', t.status, 'staff_note', t.staff_note,
    'created_at', t.created_at, 'updated_at', t.updated_at, 'completed_at', t.completed_at,
    'source', t.source, 'category', t.category, 'link', t.link,
    'files', (select count(*) from staff_files f where f.task_id = t.id));
$$;

create or replace function public.staff_my_tasks()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); res jsonb;
begin
  if sid is null then return jsonb_build_object('ok', true, 'data', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(task_json(t) order by (t.status in ('todo','doing')) desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t where t.staff_id = sid;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.admin_tasks()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare res jsonb;
begin
  perform admin_guard();
  select coalesce(jsonb_agg(task_json(t) || jsonb_build_object('staff_name', s.name, 'staff_kind', s.kind)
      order by (t.status in ('todo','doing')) desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t join staff s on s.id = t.staff_id;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- intern adds / edits a row of their own sheet (p_id null = new row). Admin-given rows: only the
-- status can change (staff_set_task_status); they can't be renamed or deleted by the intern.
create or replace function public.staff_task_save(p_id uuid, p_title text, p_details text default null,
  p_priority text default 'normal', p_due date default null, p_category text default null,
  p_link text default null, p_status text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_intern_id(); t staff_tasks; st text := coalesce(nullif(p_status,''), 'todo');
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Only interns can keep their own task list'); end if;
  if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Write the task'); end if;
  if coalesce(p_priority,'') not in ('low','normal','high') then p_priority := 'normal'; end if;
  if st not in ('todo','doing','done','not_done') then st := 'todo'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  if p_id is null then
    insert into staff_tasks (staff_id, title, details, priority, due_date, status, source, category, link, created_by,
                             completed_at)
    values (sid, left(trim(p_title), 200), nullif(trim(coalesce(p_details,'')), ''), p_priority, p_due, st, 'self',
            nullif(trim(coalesce(p_category,'')), ''), nullif(trim(coalesce(p_link,'')), ''), auth.uid(),
            case when st = 'done' then now() end)
    returning * into t;
  else
    update staff_tasks set title = left(trim(p_title), 200), details = nullif(trim(coalesce(p_details,'')), ''),
           priority = p_priority, due_date = p_due, category = nullif(trim(coalesce(p_category,'')), ''),
           link = nullif(trim(coalesce(p_link,'')), ''), status = st,
           completed_at = case when st = 'done' then coalesce(completed_at, now()) else null end, updated_at = now()
     where id = p_id and staff_id = sid and source = 'self' returning * into t;
    if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Task not found (tasks from the admin can only change status)'); end if;
  end if;
  return jsonb_build_object('ok', true, 'data', task_json(t));
end $$;

create or replace function public.staff_task_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_intern_id(); n int;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Only interns can delete their own tasks'); end if;
  delete from staff_tasks where id = p_id and staff_id = sid and source = 'self';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'msg', 'Only your own tasks can be deleted'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- status change: now also "doing"; admins are told only when an admin-given task is done / not done
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
   where id = p_task and staff_id = sid returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  if p_status in ('done', 'not_done') and t.source = 'admin' then
    select name into who from staff where id = sid;
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'task_' || p_status,
        case when p_status = 'done' then '✅ ' || who || ' ne kaam pura kiya' else '⚠️ ' || who || ': kaam nahi hua' end,
        t.title || coalesce(' — ' || t.staff_note, ''));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', case p_status when 'done' then 'Shabaash! Kaam complete ✓'
                                                             when 'not_done' then 'Admin ko bata diya'
                                                             when 'doing' then 'Kaam chalu' else 'Kaam wapas baaki me' end);
end $$;

-- admin: set category / link on any task (admin_add_task / admin_update_task keep their signatures)
create or replace function public.admin_task_meta(p_task uuid, p_category text, p_link text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  perform admin_guard();
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  update staff_tasks set category = nullif(trim(coalesce(p_category,'')), ''), link = nullif(trim(coalesce(p_link,'')), ''),
         updated_at = now() where id = p_task;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Kaam nahi mila'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- files & links ----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('staff-files', 'staff-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "staff-files read" on storage.objects;
drop policy if exists "staff-files write" on storage.objects;
drop policy if exists "staff-files delete" on storage.objects;
create policy "staff-files read" on storage.objects for select to authenticated
  using (bucket_id = 'staff-files' and ((storage.foldername(name))[1] = my_staff_id()::text or is_admin()));
create policy "staff-files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-files' and ((storage.foldername(name))[1] = my_staff_id()::text or is_admin()));
create policy "staff-files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'staff-files' and ((storage.foldername(name))[1] = my_staff_id()::text or is_admin()));

create or replace function public.file_json(f staff_files)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', f.id, 'staff_id', f.staff_id, 'kind', f.kind, 'name', f.name, 'path', f.path,
    'url', f.url, 'size', f.size, 'mime', f.mime, 'task_id', f.task_id,
    'task_title', (select title from staff_tasks where id = f.task_id), 'note', f.note,
    'from_admin', f.from_admin, 'uploader_name', f.uploader_name, 'created_at', f.created_at);
$$;

-- p_staff: whose folder (staff: always themselves; admin: the intern it is shared with)
create or replace function public.team_file_add(p_staff uuid, p_kind text, p_name text, p_path text default null,
  p_url text default null, p_size bigint default null, p_mime text default null, p_task uuid default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); target uuid; f staff_files; who text; r uuid;
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
  if p_task is not null and not exists (select 1 from staff_tasks where id = p_task and staff_id = target) then p_task := null; end if;
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
  end if;
  return jsonb_build_object('ok', true, 'data', file_json(f));
end $$;

create or replace function public.team_files(p_staff uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); res jsonb;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  select coalesce(jsonb_agg(file_json(f) || jsonb_build_object('staff_name', s.name) order by f.created_at desc), '[]'::jsonb)
    into res from staff_files f join staff s on s.id = f.staff_id
   where case when adm then (p_staff is null or f.staff_id = p_staff) else f.staff_id = me end;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- returns the storage path so the page can remove the object too
create or replace function public.team_file_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); f staff_files;
begin
  delete from staff_files where id = p_id and (adm or (staff_id = me and uploaded_by = auth.uid())) returning * into f;
  if f.id is null then return jsonb_build_object('ok', false, 'msg', 'You can only delete what you shared'); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('path', f.path));
end $$;

-- ---------- meetings (Google Meet link + reminders) ----------
create table if not exists staff_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agenda text,
  starts_at timestamptz not null,
  duration_min int not null default 30,
  meet_link text,
  attendees uuid[] not null default '{}',   -- staff ids
  with_admin boolean not null default true,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  notes text,
  reminded boolean not null default false,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
alter table staff_meetings enable row level security;
create index if not exists staff_meetings_start_idx on staff_meetings(starts_at);

create or replace function public.team_people()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name,
    'kind', kind, 'role', role) order by kind, name) from staff where is_active), '[]'::jsonb));
end $$;

create or replace function public.meeting_json(m staff_meetings)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', m.id, 'title', m.title, 'agenda', m.agenda, 'starts_at', m.starts_at,
    'duration_min', m.duration_min, 'meet_link', m.meet_link, 'attendees', m.attendees, 'with_admin', m.with_admin,
    'attendee_names', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb) from staff s where s.id = any(m.attendees)),
    'status', m.status, 'notes', m.notes, 'created_by_name', m.created_by_name,
    'mine', m.created_by = auth.uid(), 'created_at', m.created_at);
$$;

create or replace function public.team_meeting_save(p_id uuid, p_title text, p_agenda text, p_starts timestamptz,
  p_duration int, p_link text, p_attendees uuid[], p_with_admin boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); m staff_meetings; who text; r uuid; att uuid[]; isnew boolean := p_id is null;
  msg text;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give the meeting a title'); end if;
  if p_starts is null then return jsonb_build_object('ok', false, 'msg', 'Pick a date and time'); end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  att := array(select distinct x from unnest(coalesce(p_attendees, '{}') || case when me is not null then array[me] else '{}' end) x
               where x in (select id from staff where is_active));
  who := coalesce((select name from staff where auth_user_id = auth.uid() limit 1), 'Admin');
  if isnew then
    insert into staff_meetings (title, agenda, starts_at, duration_min, meet_link, attendees, with_admin, created_by, created_by_name)
    values (left(trim(p_title),150), nullif(trim(coalesce(p_agenda,'')),''), p_starts, greatest(5, least(coalesce(p_duration,30), 480)),
            nullif(trim(coalesce(p_link,'')),''), att, coalesce(p_with_admin, true) or adm, auth.uid(), who)
    returning * into m;
  else
    update staff_meetings set title = left(trim(p_title),150), agenda = nullif(trim(coalesce(p_agenda,'')),''), starts_at = p_starts,
           duration_min = greatest(5, least(coalesce(p_duration,30), 480)), meet_link = nullif(trim(coalesce(p_link,'')),''),
           attendees = att, with_admin = coalesce(p_with_admin, true) or adm,
           reminded = case when starts_at <> p_starts then false else reminded end
     where id = p_id and (adm or created_by = auth.uid()) and status = 'scheduled' returning * into m;
    if m.id is null then return jsonb_build_object('ok', false, 'msg', 'Only the person who scheduled it can change it'); end if;
  end if;
  msg := to_char(m.starts_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' · ' || m.title;
  for r in select auth_user_id from staff where id = any(m.attendees) and auth_user_id is distinct from auth.uid() loop
    perform team_notify(r, 'staff', 'meeting', case when isnew then '📅 Meeting scheduled' else '📅 Meeting updated' end, msg);
  end loop;
  if m.with_admin and not adm then
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'meeting', case when isnew then '📅 ' || who || ' ne meeting rakhi' else '📅 Meeting badli' end, msg);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'data', meeting_json(m));
end $$;

create or replace function public.team_meetings(p_days_back int default 14)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); res jsonb;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  select coalesce(jsonb_agg(meeting_json(m) order by m.starts_at), '[]'::jsonb) into res from staff_meetings m
   where m.starts_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days_back,14), 120)))
     and (adm or me = any(m.attendees) or m.created_by = auth.uid());
  return jsonb_build_object('ok', true, 'data', res);
end $$;

create or replace function public.team_meeting_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare adm boolean := is_admin(); m staff_meetings; r uuid;
begin
  update staff_meetings set status = 'cancelled' where id = p_id and (adm or created_by = auth.uid()) and status = 'scheduled' returning * into m;
  if m.id is null then return jsonb_build_object('ok', false, 'msg', 'Only the person who scheduled it can cancel it'); end if;
  for r in select auth_user_id from staff where id = any(m.attendees) and auth_user_id is distinct from auth.uid() loop
    perform team_notify(r, 'staff', 'meeting', '❌ Meeting cancelled', m.title);
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- minutes / notes after the meeting: any attendee, the creator or an admin
create or replace function public.team_meeting_notes(p_id uuid, p_notes text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id();
begin
  update staff_meetings set notes = nullif(trim(coalesce(p_notes,'')),'')
   where id = p_id and (is_admin() or created_by = auth.uid() or me = any(attendees));
  if not found then return jsonb_build_object('ok', false, 'msg', 'Meeting not found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- cron: 15-minute heads-up to everyone in the meeting
create or replace function public.rz_meeting_reminders()
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m staff_meetings; r uuid; msg text;
begin
  for m in select * from staff_meetings where status = 'scheduled' and not reminded
            and starts_at between now() and now() + interval '16 minutes' loop
    msg := to_char(m.starts_at at time zone 'Asia/Kolkata', 'HH12:MI AM') || ' · ' || m.title ||
           case when m.meet_link is not null then ' — tap to join' else '' end;
    for r in select auth_user_id from staff where id = any(m.attendees) and is_active loop
      perform team_notify(r, 'staff', 'meeting', '⏰ Meeting in 15 minutes', msg);
    end loop;
    if m.with_admin then
      for r in select admin_user_ids() loop perform team_notify(r, 'admin', 'meeting', '⏰ Meeting 15 min me', msg); end loop;
    end if;
    update staff_meetings set reminded = true where id = m.id;
  end loop;
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'rz-meeting-reminders';
select cron.schedule('rz-meeting-reminders', '*/5 * * * *', 'select public.rz_meeting_reminders()');

-- ---------- daily report (stand-up) ----------
create table if not exists staff_daily_reports (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  day date not null,
  done text,
  plan text,
  blockers text,
  hours numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, day)
);
alter table staff_daily_reports enable row level security;

create or replace function public.staff_report_save(p_day date, p_done text, p_plan text, p_blockers text, p_hours numeric)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); d date := coalesce(p_day, ist_date()); isnew boolean; who text; r uuid;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if d > ist_date() or d < ist_date() - 7 then return jsonb_build_object('ok', false, 'msg', 'You can fill today or the last 7 days'); end if;
  if coalesce(trim(p_done),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Write what you did'); end if;
  isnew := not exists (select 1 from staff_daily_reports where staff_id = sid and day = d);
  insert into staff_daily_reports (staff_id, day, done, plan, blockers, hours)
  values (sid, d, trim(p_done), nullif(trim(coalesce(p_plan,'')),''), nullif(trim(coalesce(p_blockers,'')),''),
          case when p_hours between 0 and 24 then p_hours end)
  on conflict (staff_id, day) do update set done = excluded.done, plan = excluded.plan, blockers = excluded.blockers,
     hours = excluded.hours, updated_at = now();
  if isnew then
    select name into who from staff where id = sid;
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'daily_report', '🗒️ ' || who || ' ki daily report',
        left(trim(p_done), 120) || case when coalesce(trim(p_blockers),'') <> '' then ' · ⚠️ blocker' else '' end);
    end loop;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.team_reports(p_days int default 30, p_staff uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); res jsonb;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'staff_id', x.staff_id, 'staff_name', s.name, 'day', x.day,
      'done', x.done, 'plan', x.plan, 'blockers', x.blockers, 'hours', x.hours, 'updated_at', x.updated_at)
      order by x.day desc, s.name), '[]'::jsonb)
    into res from staff_daily_reports x join staff s on s.id = x.staff_id
   where x.day >= ist_date() - greatest(1, least(coalesce(p_days,30), 365))
     and case when adm then (p_staff is null or x.staff_id = p_staff) else x.staff_id = me end;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- ---------- grants ----------
do $$ declare f text; begin
  foreach f in array array['my_intern_id()','admin_user_ids()','task_json(staff_tasks)','file_json(staff_files)',
    'meeting_json(staff_meetings)','rz_meeting_reminders()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['staff_task_save(uuid,text,text,text,date,text,text,text)','staff_task_delete(uuid)',
    'admin_task_meta(uuid,text,text)','team_file_add(uuid,text,text,text,text,bigint,text,uuid,text)','team_files(uuid)',
    'team_file_delete(uuid)','team_people()','team_meeting_save(uuid,text,text,timestamptz,int,text,uuid[],boolean)',
    'team_meetings(int)','team_meeting_cancel(uuid)','team_meeting_notes(uuid,text)',
    'staff_report_save(date,text,text,text,numeric)','team_reports(int,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
