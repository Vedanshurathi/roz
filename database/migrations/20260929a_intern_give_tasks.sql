-- Interns give tasks to each other (29 Sep 2026)
-- staff_tasks.source = 'peer' + assigned_by (the intern who gave it).
-- The receiver owns the task (staff_id) like an admin task: changes status, checklist, files, comments.
-- The giver sees it in staff_my_tasks (given_by_me), can edit / delete it, and is notified on done / not done / comments.

alter table staff_tasks add column if not exists assigned_by uuid references staff(id) on delete set null;
alter table staff_tasks drop constraint if exists staff_tasks_source_check;
alter table staff_tasks add constraint staff_tasks_source_check check (source in ('admin','self','peer'));
create index if not exists staff_tasks_assigned_by_idx on staff_tasks(assigned_by) where assigned_by is not null;

create or replace function public.task_json(t staff_tasks)
 returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('id', t.id, 'staff_id', t.staff_id, 'title', t.title, 'details', t.details,
    'priority', t.priority, 'due_date', t.due_date, 'status', t.status, 'staff_note', t.staff_note,
    'created_at', t.created_at, 'updated_at', t.updated_at, 'completed_at', t.completed_at,
    'source', t.source, 'category', t.category, 'link', t.link, 'checklist', t.checklist,
    'collaborators', t.collaborators,
    'collab_names', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb) from staff s where s.id = any(t.collaborators)),
    'owner_name', (select name from staff where id = t.staff_id),
    'owner', t.staff_id = my_staff_id(),
    'assigned_by', t.assigned_by,
    'assigned_by_name', (select name from staff where id = t.assigned_by),
    'given_by_me', t.assigned_by is not null and t.assigned_by = my_staff_id(),
    'comments', (select count(*) from task_comments c where c.task_id = t.id),
    'last_comment_at', (select max(created_at) from task_comments c where c.task_id = t.id),
    'files', (select count(*) from staff_files f where f.task_id = t.id));
$$;

create or replace function public.task_can(t staff_tasks)
 returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select is_admin() or t.staff_id = my_staff_id() or my_staff_id() = any(t.collaborators)
      or (t.assigned_by is not null and t.assigned_by = my_staff_id());
$$;

create or replace function public.task_people(t staff_tasks)
 returns setof uuid language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select auth_user_id from staff where (id = t.staff_id or id = any(t.collaborators) or id = t.assigned_by) and is_active
     and auth_user_id is distinct from auth.uid();
$$;

create or replace function public.staff_my_tasks()
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare sid uuid := my_staff_id(); res jsonb;
begin
  if sid is null then return jsonb_build_object('ok', true, 'data', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(task_json(t) order by (t.status in ('todo','doing')) desc, t.due_date nulls last, t.created_at desc), '[]'::jsonb)
    into res from staff_tasks t where t.staff_id = sid or sid = any(t.collaborators) or t.assigned_by = sid;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- give a task to one or more interns (one copy each)
create or replace function public.staff_task_assign(p_to uuid[], p_title text, p_details text default null,
  p_priority text default 'normal', p_due date default null, p_category text default null, p_link text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare sid uuid := my_intern_id(); who text; t staff_tasks; res jsonb := '[]'::jsonb; r record; n int := 0;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Only interns can give tasks here'); end if;
  if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Write the task'); end if;
  if coalesce(p_priority,'') not in ('low','normal','high') then p_priority := 'normal'; end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then p_link := 'https://' || trim(p_link); end if;
  select name into who from staff where id = sid;
  for r in select id, auth_user_id, name from staff
            where id = any(coalesce(p_to, '{}')) and id <> sid and is_active and kind = 'intern' limit 10 loop
    insert into staff_tasks (staff_id, title, details, priority, due_date, status, source, category, link, created_by, assigned_by)
    values (r.id, left(trim(p_title), 200), nullif(trim(coalesce(p_details,'')), ''), p_priority, p_due, 'todo', 'peer',
            nullif(trim(coalesce(p_category,'')), ''), nullif(trim(coalesce(p_link,'')), ''), auth.uid(), sid)
    returning * into t;
    perform team_notify(r.auth_user_id, 'staff', 'task_new', '📌 ' || who || ' gave you a task',
      t.title || coalesce(' · due ' || to_char(t.due_date, 'DD Mon'), ''));
    res := res || jsonb_build_array(task_json(t)); n := n + 1;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'msg', 'Pick at least one teammate'); end if;
  return jsonb_build_object('ok', true, 'data', res);
end $$;

-- own tasks: as before; given tasks: the giver edits them (status stays with the receiver)
create or replace function public.staff_task_save(p_id uuid, p_title text, p_details text default null, p_priority text default 'normal',
  p_due date default null, p_category text default null, p_link text default null, p_status text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
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
           link = nullif(trim(coalesce(p_link,'')), ''),
           status = case when source = 'peer' then status else st end,
           completed_at = case when source = 'peer' then completed_at when st = 'done' then coalesce(completed_at, now()) else null end,
           updated_at = now()
     where id = p_id and ((staff_id = sid and source = 'self') or (assigned_by = sid and source = 'peer')) returning * into t;
    if t.id is null then return jsonb_build_object('ok', false, 'msg', 'Task not found (tasks given to you can only change status)'); end if;
  end if;
  return jsonb_build_object('ok', true, 'data', task_json(t));
end $$;

create or replace function public.staff_task_delete(p_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare sid uuid := my_intern_id(); n int;
begin
  if sid is null then return jsonb_build_object('ok', false, 'msg', 'Only interns can delete their own tasks'); end if;
  delete from staff_tasks where id = p_id and ((staff_id = sid and source = 'self') or (assigned_by = sid and source = 'peer'));
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'msg', 'Only tasks you made or gave can be deleted'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- status: same rules; the giver of a peer task is told (through task_people)
create or replace function public.staff_set_task_status(p_task uuid, p_status text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
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
        case when p_status = 'done' then '✅ ' || who || ' finished a task' else '⚠️ ' || who || ': task not done' end,
        t.title || case when p_status = 'not_done' then coalesce(' — ' || t.staff_note, '') else '' end);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', case p_status when 'done' then 'Shabaash! Kaam complete ✓'
                                                             when 'not_done' then 'Admin ko bata diya'
                                                             when 'doing' then 'Kaam chalu' else 'Kaam wapas baaki me' end);
end $$;

-- files on a given task: the giver can attach and open them too
create or replace function public.can_read_staff_file(p_path text)
 returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from staff_files f left join staff_tasks t on t.id = f.task_id
    where f.path = p_path and my_staff_id() is not null
      and (my_staff_id() = any(f.shared_with) or (t.id is not null and (t.staff_id = my_staff_id() or my_staff_id() = any(t.collaborators)
           or t.assigned_by = my_staff_id()))));
$$;

create or replace function public.team_file_add(p_staff uuid, p_kind text, p_name text, p_path text default null, p_url text default null,
  p_size bigint default null, p_mime text default null, p_task uuid default null, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
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
    select * into t from staff_tasks where id = p_task and (staff_id = target or target = any(collaborators) or assigned_by = target);
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

revoke all on function public.staff_task_assign(uuid[], text, text, text, date, text, text) from public, anon;
grant execute on function public.staff_task_assign(uuid[], text, text, text, date, text, text) to authenticated;
