-- Intern workspace, round 2:
--  * meetings: invite people by Gmail (guest_emails) — used for the Google Calendar invite link
--  * tasks: checklist (sub-steps) on every task
--  * 5 new tools: content calendar, bugs & ideas tracker, work timer (clock in/out), team notes & links, leave requests
-- All RPC-only, RLS on with no table policies. Team-wide tools (content, bugs, notes) are visible to every active
-- staff member + admins; timer and leave are per person (admins see all).

-- ---------- meetings: guest emails ----------
alter table staff_meetings add column if not exists guest_emails text[] not null default '{}';

drop function if exists public.team_meeting_save(uuid,text,text,timestamptz,int,text,uuid[],boolean);
create or replace function public.team_meeting_save(p_id uuid, p_title text, p_agenda text, p_starts timestamptz,
  p_duration int, p_link text, p_attendees uuid[], p_with_admin boolean default true, p_guests text[] default '{}')
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); m staff_meetings; who text; r uuid; att uuid[]; isnew boolean := p_id is null;
  msg text; g text[];
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
            nullif(trim(coalesce(p_link,'')),''), att, g, coalesce(p_with_admin, true) or adm, auth.uid(), who)
    returning * into m;
  else
    update staff_meetings set title = left(trim(p_title),150), agenda = nullif(trim(coalesce(p_agenda,'')),''), starts_at = p_starts,
           duration_min = greatest(5, least(coalesce(p_duration,30), 480)), meet_link = nullif(trim(coalesce(p_link,'')),''),
           attendees = att, guest_emails = g, with_admin = coalesce(p_with_admin, true) or adm,
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

create or replace function public.meeting_json(m staff_meetings)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', m.id, 'title', m.title, 'agenda', m.agenda, 'starts_at', m.starts_at,
    'duration_min', m.duration_min, 'meet_link', m.meet_link, 'attendees', m.attendees, 'with_admin', m.with_admin,
    'attendee_names', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb) from staff s where s.id = any(m.attendees)),
    'guest_emails', m.guest_emails, 'status', m.status, 'notes', m.notes, 'created_by_name', m.created_by_name,
    'mine', m.created_by = auth.uid(), 'created_at', m.created_at);
$$;

-- ---------- tasks: checklist ----------
alter table staff_tasks add column if not exists checklist jsonb not null default '[]';

create or replace function public.task_json(t staff_tasks)
returns jsonb language sql stable security definer set search_path to 'public','pg_temp' as $$
  select jsonb_build_object('id', t.id, 'staff_id', t.staff_id, 'title', t.title, 'details', t.details,
    'priority', t.priority, 'due_date', t.due_date, 'status', t.status, 'staff_note', t.staff_note,
    'created_at', t.created_at, 'updated_at', t.updated_at, 'completed_at', t.completed_at,
    'source', t.source, 'category', t.category, 'link', t.link, 'checklist', t.checklist,
    'files', (select count(*) from staff_files f where f.task_id = t.id));
$$;

-- checklist = [{t:"step", d:true|false}, …]; the task's own person can tick it on any of their tasks (admin ones too)
create or replace function public.staff_task_checklist(p_id uuid, p_checklist jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); t staff_tasks; cl jsonb;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if jsonb_typeof(coalesce(p_checklist,'[]'::jsonb)) <> 'array' then return jsonb_build_object('ok', false, 'msg', 'Bad checklist'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('t', left(trim(e->>'t'), 200), 'd', coalesce((e->>'d')::boolean, false))), '[]'::jsonb)
    into cl from (select e from jsonb_array_elements(p_checklist) e where coalesce(trim(e->>'t'),'') <> '' limit 50) x;
  update staff_tasks set checklist = cl, updated_at = now() where id = p_id and staff_id = sid returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Task not found'); end if;
  return jsonb_build_object('ok', true, 'data', task_json(t));
end $$;

-- ---------- helpers ----------
create or replace function public.team_who()
returns text language sql stable security definer set search_path to 'public','pg_temp' as $$
  select coalesce((select name from staff where auth_user_id = auth.uid() and is_active limit 1),
                  case when is_admin() then 'Admin' end);
$$;

-- ---------- 1. content calendar (marketing) ----------
create table if not exists content_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null default 'Instagram',
  post_date date,
  post_time time,
  caption text,
  hashtags text,
  status text not null default 'idea' check (status in ('idea','draft','ready','posted')),
  link text,
  owner_staff uuid references staff(id) on delete set null,
  created_by uuid, created_by_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table content_posts enable row level security;

create or replace function public.team_posts(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('owner_name', s.name,
      'mine', p.created_by = auth.uid()) order by p.post_date nulls last, p.post_time nulls last, p.created_at)
    from content_posts p left join staff s on s.id = p.owner_staff
   where (p_from is null or p.post_date is null or p.post_date >= p_from) and (p_to is null or p.post_date is null or p.post_date <= p_to)), '[]'::jsonb));
end $$;

create or replace function public.team_post_save(p_id uuid, p_title text, p_platform text, p_date date, p_time time,
  p_caption text, p_hashtags text, p_status text, p_link text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare p content_posts;
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give the post a title'); end if;
  if coalesce(p_status,'') not in ('idea','draft','ready','posted') then p_status := 'idea'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  if p_id is null then
    insert into content_posts (title, platform, post_date, post_time, caption, hashtags, status, link, owner_staff, created_by, created_by_name)
    values (left(trim(p_title),150), coalesce(nullif(trim(p_platform),''),'Instagram'), p_date, p_time, nullif(trim(coalesce(p_caption,'')),''),
            nullif(trim(coalesce(p_hashtags,'')),''), p_status, nullif(trim(coalesce(p_link,'')),''), my_staff_id(), auth.uid(), team_who())
    returning * into p;
  else
    update content_posts set title = left(trim(p_title),150), platform = coalesce(nullif(trim(p_platform),''),'Instagram'), post_date = p_date,
           post_time = p_time, caption = nullif(trim(coalesce(p_caption,'')),''), hashtags = nullif(trim(coalesce(p_hashtags,'')),''),
           status = p_status, link = nullif(trim(coalesce(p_link,'')),''), updated_at = now()
     where id = p_id returning * into p;
    if p.id is null then return jsonb_build_object('ok', false, 'msg', 'Post not found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(p));
end $$;

create or replace function public.team_post_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  delete from content_posts where id = p_id and (is_admin() or created_by = auth.uid());
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only the person who added it can delete it'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 2. bugs & ideas (developers) ----------
create table if not exists dev_issues (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'bug' check (kind in ('bug','feature','idea')),
  app text not null default 'customer' check (app in ('customer','vendor','staff','admin','website','other')),
  title text not null,
  details text,
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','fixed','wont_fix')),
  link text,
  assignee uuid references staff(id) on delete set null,
  created_by uuid, created_by_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);
alter table dev_issues enable row level security;

create or replace function public.team_issues()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('assignee_name', s.name,
      'mine', i.created_by = auth.uid())
      order by (i.status in ('open','in_progress')) desc, array_position(array['critical','high','normal','low'], i.severity), i.created_at desc)
    from dev_issues i left join staff s on s.id = i.assignee), '[]'::jsonb));
end $$;

create or replace function public.team_issue_save(p_id uuid, p_kind text, p_app text, p_title text, p_details text,
  p_severity text, p_status text, p_link text, p_assignee uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare i dev_issues; r uuid; isnew boolean := p_id is null; old_assignee uuid;
begin
  if not isnew then select assignee into old_assignee from dev_issues where id = p_id; end if;
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Write a short title'); end if;
  if coalesce(p_kind,'') not in ('bug','feature','idea') then p_kind := 'bug'; end if;
  if coalesce(p_app,'') not in ('customer','vendor','staff','admin','website','other') then p_app := 'other'; end if;
  if coalesce(p_severity,'') not in ('low','normal','high','critical') then p_severity := 'normal'; end if;
  if coalesce(p_status,'') not in ('open','in_progress','fixed','wont_fix') then p_status := 'open'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  if p_assignee is not null and not exists (select 1 from staff where id = p_assignee and is_active) then p_assignee := null; end if;
  if isnew then
    insert into dev_issues (kind, app, title, details, severity, status, link, assignee, created_by, created_by_name)
    values (p_kind, p_app, left(trim(p_title),200), nullif(trim(coalesce(p_details,'')),''), p_severity, p_status,
            nullif(trim(coalesce(p_link,'')),''), p_assignee, auth.uid(), team_who())
    returning * into i;
  else
    update dev_issues set kind = p_kind, app = p_app, title = left(trim(p_title),200), details = nullif(trim(coalesce(p_details,'')),''),
           severity = p_severity, status = p_status, link = nullif(trim(coalesce(p_link,'')),''), assignee = p_assignee, updated_at = now(),
           closed_at = case when p_status in ('fixed','wont_fix') then coalesce(closed_at, now()) else null end
     where id = p_id returning * into i;
    if i.id is null then return jsonb_build_object('ok', false, 'msg', 'Not found'); end if;
  end if;
  if isnew and (i.kind = 'bug' and i.severity in ('high','critical')) and not is_admin() then
    for r in select admin_user_ids() loop
      perform team_notify(r, 'admin', 'issue', case when i.severity = 'critical' then '🚨 Critical bug' else '🐞 High bug' end || ' · ' || i.app, i.title);
    end loop;
  end if;
  if i.assignee is not null and i.assignee is distinct from old_assignee then
    select auth_user_id into r from staff where id = i.assignee;
    if r is not null and r is distinct from auth.uid() then
      perform team_notify(r, 'staff', 'issue',
        case i.kind when 'bug' then '🐞 Bug for you' when 'feature' then '✨ Feature for you' else '💡 Idea for you' end, i.title);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(i));
end $$;

create or replace function public.team_issue_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  delete from dev_issues where id = p_id and (is_admin() or created_by = auth.uid());
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only the person who added it can delete it'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 3. work timer (clock in / out) ----------
create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text
);
alter table work_sessions enable row level security;
create unique index if not exists work_sessions_one_open on work_sessions(staff_id) where ended_at is null;
create index if not exists work_sessions_staff_idx on work_sessions(staff_id, started_at desc);

create or replace function public.staff_clock(p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); w work_sessions;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if p_action = 'in' then
    select * into w from work_sessions where staff_id = sid and ended_at is null;
    if w.id is not null then return jsonb_build_object('ok', true, 'data', to_jsonb(w)); end if;
    insert into work_sessions (staff_id, note) values (sid, nullif(trim(coalesce(p_note,'')),'')) returning * into w;
  elsif p_action = 'out' then
    update work_sessions set ended_at = least(now(), started_at + interval '14 hours'),
           note = coalesce(nullif(trim(coalesce(p_note,'')),''), note)
     where staff_id = sid and ended_at is null returning * into w;
    if w.id is null then return jsonb_build_object('ok', false, 'msg', 'The timer is not running'); end if;
  else return jsonb_build_object('ok', false, 'msg', 'Bad action'); end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(w));
end $$;

-- sessions + minutes per IST day (open session counts up to now, max 14 h)
create or replace function public.team_timesheet(p_days int default 14, p_staff uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin(); since timestamptz;
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  since := (ist_date() - greatest(1, least(coalesce(p_days,14), 90)))::timestamp at time zone 'Asia/Kolkata';
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'staff_id', w.staff_id, 'staff_name', s.name,
        'started_at', w.started_at, 'ended_at', w.ended_at, 'note', w.note,
        'minutes', round(extract(epoch from (least(coalesce(w.ended_at, now()), w.started_at + interval '14 hours') - w.started_at)) / 60))
        order by w.started_at desc)
      from work_sessions w join staff s on s.id = w.staff_id
     where w.started_at >= since and case when adm then (p_staff is null or w.staff_id = p_staff) else w.staff_id = me end), '[]'::jsonb),
    'open', (select to_jsonb(w) from work_sessions w where w.staff_id = coalesce(case when adm then p_staff end, me) and w.ended_at is null)));
end $$;

-- ---------- 4. team notes & links ----------
create table if not exists team_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  url text,
  category text not null default 'Guide',
  pinned boolean not null default false,
  created_by uuid, created_by_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table team_notes enable row level security;

create or replace function public.team_notes_list()
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(to_jsonb(n) || jsonb_build_object('mine', n.created_by = auth.uid())
    order by n.pinned desc, n.updated_at desc) from team_notes n), '[]'::jsonb));
end $$;

create or replace function public.team_note_save(p_id uuid, p_title text, p_body text, p_url text, p_category text, p_pinned boolean)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare n team_notes; adm boolean := is_admin();
begin
  if not is_staff() then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'msg', 'Give it a title'); end if;
  if p_url is not null and trim(p_url) <> '' and trim(p_url) !~* '^https?://' then p_url := 'https://' || trim(p_url); end if;
  if p_id is null then
    insert into team_notes (title, body, url, category, pinned, created_by, created_by_name)
    values (left(trim(p_title),150), nullif(trim(coalesce(p_body,'')),''), nullif(trim(coalesce(p_url,'')),''),
            coalesce(nullif(trim(p_category),''),'Guide'), adm and coalesce(p_pinned,false), auth.uid(), team_who())
    returning * into n;
  else
    update team_notes set title = left(trim(p_title),150), body = nullif(trim(coalesce(p_body,'')),''), url = nullif(trim(coalesce(p_url,'')),''),
           category = coalesce(nullif(trim(p_category),''),'Guide'), pinned = case when adm then coalesce(p_pinned,false) else pinned end, updated_at = now()
     where id = p_id and (adm or created_by = auth.uid()) returning * into n;
    if n.id is null then return jsonb_build_object('ok', false, 'msg', 'Only the person who wrote it can change it'); end if;
  end if;
  return jsonb_build_object('ok', true, 'data', to_jsonb(n));
end $$;

create or replace function public.team_note_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  delete from team_notes where id = p_id and (is_admin() or created_by = auth.uid());
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only the person who wrote it can delete it'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 5. leave requests ----------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  kind text not null default 'leave' check (kind in ('leave','sick','half_day','wfh')),
  from_date date not null,
  to_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table leave_requests enable row level security;

create or replace function public.staff_leave_request(p_kind text, p_from date, p_to date, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid uuid := my_staff_id(); l leave_requests; r uuid; who text;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  if p_from is null then return jsonb_build_object('ok', false, 'msg', 'Pick the date'); end if;
  p_to := coalesce(p_to, p_from);
  if p_to < p_from then return jsonb_build_object('ok', false, 'msg', 'The end date is before the start date'); end if;
  if p_to - p_from > 30 then return jsonb_build_object('ok', false, 'msg', 'At most 30 days at a time'); end if;
  if coalesce(p_kind,'') not in ('leave','sick','half_day','wfh') then p_kind := 'leave'; end if;
  insert into leave_requests (staff_id, kind, from_date, to_date, reason) values (sid, p_kind, p_from, p_to, nullif(trim(coalesce(p_reason,'')),''))
  returning * into l;
  select name into who from staff where id = sid;
  for r in select admin_user_ids() loop
    perform team_notify(r, 'admin', 'leave', '🏖️ ' || who || ' ne chhutti maangi',
      to_char(l.from_date, 'DD Mon') || case when l.to_date > l.from_date then ' – ' || to_char(l.to_date, 'DD Mon') else '' end
      || coalesce(' · ' || l.reason, ''));
  end loop;
  return jsonb_build_object('ok', true, 'data', to_jsonb(l));
end $$;

create or replace function public.team_leaves(p_staff uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare me uuid := my_staff_id(); adm boolean := is_admin();
begin
  if not adm and me is null then return jsonb_build_object('ok', false, 'msg', 'Not a staff account'); end if;
  return jsonb_build_object('ok', true, 'data', coalesce((select jsonb_agg(to_jsonb(l) || jsonb_build_object('staff_name', s.name)
      order by (l.status = 'pending') desc, l.from_date desc)
    from leave_requests l join staff s on s.id = l.staff_id
   where l.from_date >= ist_date() - 120 and case when adm then (p_staff is null or l.staff_id = p_staff) else l.staff_id = me end), '[]'::jsonb));
end $$;

create or replace function public.staff_leave_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  update leave_requests set status = 'cancelled' where id = p_id and staff_id = my_staff_id() and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'msg', 'Only a pending request can be cancelled'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_leave_decide(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare l leave_requests;
begin
  perform admin_guard();
  update leave_requests set status = case when p_approve then 'approved' else 'rejected' end, admin_note = nullif(trim(coalesce(p_note,'')),''),
         decided_at = now() where id = p_id and status = 'pending' returning * into l;
  if l.id is null then return jsonb_build_object('ok', false, 'msg', 'Request nahi mili (ya pehle hi decide ho gayi)'); end if;
  perform team_notify((select auth_user_id from staff where id = l.staff_id), 'staff', 'leave',
    case when p_approve then '✅ Leave approved' else '❌ Leave not approved' end,
    to_char(l.from_date, 'DD Mon') || case when l.to_date > l.from_date then ' – ' || to_char(l.to_date, 'DD Mon') else '' end || coalesce(' · ' || l.admin_note, ''));
  return jsonb_build_object('ok', true, 'msg', case when p_approve then 'Approve ho gayi' else 'Reject ho gayi' end);
end $$;

-- ---------- grants ----------
do $$ declare f text; begin
  execute 'revoke all on function public.team_who() from public, anon, authenticated';
  foreach f in array array['team_meeting_save(uuid,text,text,timestamptz,int,text,uuid[],boolean,text[])',
    'staff_task_checklist(uuid,jsonb)','team_posts(date,date)','team_post_save(uuid,text,text,date,time,text,text,text,text)',
    'team_post_delete(uuid)','team_issues()','team_issue_save(uuid,text,text,text,text,text,text,text,uuid)','team_issue_delete(uuid)',
    'staff_clock(text,text)','team_timesheet(int,uuid)','team_notes_list()','team_note_save(uuid,text,text,text,text,boolean)',
    'team_note_delete(uuid)','staff_leave_request(text,date,date,text)','team_leaves(uuid)','staff_leave_cancel(uuid)',
    'admin_leave_decide(uuid,boolean,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
