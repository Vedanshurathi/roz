-- Full database backup as ONE .sql file (structure + all data), made inside the database.
--
--   public.rb_backup_sql()            → the backup text (service_role only)
--   public.rb_backup_sql('scratch')   → test variant: tables, data, constraints, indexes, policies,
--                                      triggers and grants in schema "scratch" (used to prove the
--                                      backup restores; run it inside a transaction and roll back)
--   public.rb_backup_claim(token)     → checks a time-limited download link (service_role only)
--   Edge function rb-backup?t=<token> → downloads the file in the browser
--
-- Order is pg_dump's: extensions, enums, tables (no defaults), views, functions, DATA, defaults,
-- constraints, indexes, identity counters, RLS + policies, triggers, grants, storage buckets +
-- policies, cron jobs. Triggers come after the data, so restoring never sends notifications.
-- Secret settings (app_settings: VAPID private key, tokens, session secret) are NOT included.

create or replace function public.rb_backup_sql(p_target text default 'public')
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  test boolean := p_target <> 'public';
  sch text := quote_ident(p_target);
  out text[] := '{}';
  r record;
  c record;
  cols text;
  js text;
  tag text;
  tname text;
  secret_keys text[] := array['vapid_private', 'item_photos_token', 'api_session_secret', 'backup_link'];
begin
  out := out || format($H$-- =====================================================================================
-- RozBazaar — full database backup (structure + data)
-- Supabase project srvpfyjmwaruebbkqkdj (Postgres %s) · made %s IST
--
-- CONTAINS PERSONAL DATA (customer names, phone numbers, addresses, orders) and login accounts.
-- Keep it private: never upload it to a website, never put it in the GitHub repo (it is public).
--
-- What is inside: every table, view, function, trigger, security policy, grant, scheduled job and
-- storage-bucket setting of the app, plus all rows of the app tables and the login accounts
-- (auth.users + auth.identities).
-- NOT inside: secret settings (VAPID private key, item-photos token, API session secret — set them
-- again after a restore), the files in Storage (item photos, staff files — download them from
-- Supabase → Storage), and the Edge Functions (their code is in the GitHub repo).
--
-- Restore into a NEW, empty Supabase project: SQL Editor → paste this file → Run
-- (or: psql "<connection string>" -f this-file.sql). It runs as one transaction: all or nothing.
-- After restoring, functions that call Edge Functions still point at the old project URL
-- (srvpfyjmwaruebbkqkdj) — search for it and replace it.
-- =====================================================================================
$H$, current_setting('server_version'), to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI'));

  if not test then
    out := out || array['set statement_timeout = 0;', 'set lock_timeout = 0;', 'set client_min_messages = warning;',
                        'set check_function_bodies = false;', 'begin;'];
  else
    out := out || format('create schema %s;', sch);
  end if;

  -- helper used by the data section (temporary: disappears when the session ends)
  out := out || $L$
create or replace function pg_temp.rb_load(p_table regclass, p_rows jsonb) returns bigint
language plpgsql as $rbload$
declare cols text; ov text; n bigint := 0;
begin
  if jsonb_array_length(p_rows) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
         case when bool_or(a.attidentity = 'a') then 'overriding system value' else '' end
    into cols, ov
    from pg_attribute a
   where a.attrelid = p_table and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and a.attname in (select jsonb_object_keys(p_rows -> 0));
  execute format('insert into %s (%s) %s select %s from jsonb_populate_recordset(null::%s, $1)',
                 p_table, cols, ov, cols, p_table) using p_rows;
  get diagnostics n = row_count;
  return n;
end $rbload$;
$L$::text;

  if not test then
    out := out || E'\n-- ===== Extensions ====='::text;
    for r in select extname, extnamespace::regnamespace::text as nsp from pg_extension
              where extname <> 'plpgsql' order by extname loop
      out := out || format('create extension if not exists %I with schema %I;', r.extname, r.nsp);
    end loop;

    out := out || E'\n-- ===== Enum types ====='::text;
    for r in select t.typname, string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as labels
               from pg_type t join pg_enum e on e.enumtypid = t.oid
              where t.typnamespace = 'public'::regnamespace
              group by t.typname order by t.typname loop
      out := out || format('create type public.%I as enum (%s);', r.typname, r.labels);
    end loop;
  end if;

  out := out || E'\n-- ===== Tables (defaults and constraints are added after the data) ====='::text;
  for c in select oid, relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
            order by relname loop
    select string_agg(format('  %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
             case a.attidentity when 'a' then ' generated always as identity'
                                when 'd' then ' generated by default as identity' else '' end,
             case when a.attnotnull then ' not null' else '' end), E',\n' order by a.attnum)
      into cols
      from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped;
    out := out || format(E'create table %s.%I (\n%s\n);', sch, c.relname, cols);
  end loop;

  if not test then
    out := out || E'\n-- ===== Views ====='::text;
    for c in select oid, relname, relkind, reloptions from pg_class
              where relnamespace = 'public'::regnamespace and relkind in ('v', 'm') order by oid loop
      out := out || format(E'create %s public.%I%s as\n%s;',
               case when c.relkind = 'm' then 'materialized view' else 'view' end, c.relname,
               case when c.reloptions is null then '' else ' with (' || array_to_string(c.reloptions, ', ') || ')' end,
               rtrim(btrim(pg_get_viewdef(c.oid, true)), ';'));
    end loop;

    out := out || E'\n-- ===== Functions ====='::text;
    for r in select p.oid from pg_proc p
              where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
                and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                                  and d.objid = p.oid and d.deptype = 'e')
              order by p.proname, p.oid loop
      out := out || (pg_get_functiondef(r.oid) || ';');
    end loop;
  end if;

  out := out || E'\n-- ===== Data ====='::text;
  -- login accounts first (customers / vendors / staff point at them)
  for r in select * from (values ('users', 1), ('identities', 2)) v(t, o) order by o loop
    if test then
      tname := format('%s.%I', sch, 'auth_' || r.t);
      out := out || format('create table %s (like auth.%I including all);', tname, r.t);
    else
      tname := format('auth.%I', r.t);
    end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)::text from auth.%I x', r.t) into js;
    tag := '$rb' || substr(md5(random()::text), 1, 10) || '$';
    out := out || format('select pg_temp.rb_load(%L, %s%s%s);', tname, tag, js, tag);
  end loop;
  for c in select oid, relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
            order by relname loop
    if c.relname = 'app_settings' then
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)::text into js
        from public.app_settings x where x.key <> all (secret_keys);
    else
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)::text from public.%I x', c.relname) into js;
    end if;
    tag := '$rb' || substr(md5(random()::text), 1, 10) || '$';
    while position(tag in js) > 0 loop
      tag := '$rb' || substr(md5(random()::text), 1, 10) || '$';
    end loop;
    out := out || format('select pg_temp.rb_load(%L, %s%s%s);', sch || '.' || quote_ident(c.relname), tag, js, tag);
  end loop;

  out := out || E'\n-- ===== Column defaults ====='::text;
  for r in select cl.relname, a.attname, pg_get_expr(d.adbin, d.adrelid) as expr
             from pg_attrdef d join pg_class cl on cl.oid = d.adrelid
             join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
            where cl.relnamespace = 'public'::regnamespace and cl.relkind = 'r' and a.attgenerated = ''
            order by cl.relname, a.attnum loop
    out := out || format('alter table only %s.%I alter column %I set default %s;', sch, r.relname, r.attname, r.expr);
  end loop;

  out := out || E'\n-- ===== Constraints (keys first, then links between tables) ====='::text;
  for r in select cl.relname, co.conname, co.contype, pg_get_constraintdef(co.oid) as def
             from pg_constraint co join pg_class cl on cl.oid = co.conrelid
            where cl.relnamespace = 'public'::regnamespace and co.contype in ('p', 'u', 'c', 'x', 'f')
            order by (co.contype = 'f'), cl.relname, co.conname loop
    out := out || format('alter table only %s.%I add constraint %I %s;', sch, r.relname, r.conname,
             case when test then replace(r.def, 'REFERENCES public.', 'REFERENCES ' || sch || '.') else r.def end);
  end loop;

  out := out || E'\n-- ===== Indexes ====='::text;
  for r in select pg_get_indexdef(i.indexrelid) as def
             from pg_index i join pg_class cl on cl.oid = i.indrelid
            where cl.relnamespace = 'public'::regnamespace and cl.relkind = 'r'
              and not exists (select 1 from pg_constraint co where co.conindid = i.indexrelid)
            order by cl.relname, i.indexrelid loop
    out := out || ((case when test then replace(r.def, ' ON public.', ' ON ' || sch || '.') else r.def end) || ';');
  end loop;

  out := out || E'\n-- ===== Identity counters ====='::text;
  for r in select cl.relname, a.attname from pg_attribute a join pg_class cl on cl.oid = a.attrelid
            where cl.relnamespace = 'public'::regnamespace and a.attidentity <> '' loop
    out := out || format('select setval(pg_get_serial_sequence(%L, %L), greatest((select max(%I) from %s.%I), 1));',
                         sch || '.' || quote_ident(r.relname), r.attname, r.attname, sch, r.relname);
  end loop;

  out := out || E'\n-- ===== Row level security + policies ====='::text;
  for c in select relname, relrowsecurity, relforcerowsecurity from pg_class
            where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname loop
    if c.relrowsecurity then out := out || format('alter table %s.%I enable row level security;', sch, c.relname); end if;
    if c.relforcerowsecurity then out := out || format('alter table %s.%I force row level security;', sch, c.relname); end if;
  end loop;
  for r in select p.polname, cl.relname, cl.relnamespace::regnamespace::text as nsp, p.polpermissive, p.polcmd,
                  case when p.polroles = '{0}' then 'public'
                       else (select string_agg(quote_ident(rolname), ', ' order by rolname) from pg_roles where oid = any(p.polroles)) end as roles,
                  pg_get_expr(p.polqual, p.polrelid) as qual, pg_get_expr(p.polwithcheck, p.polrelid) as chk
             from pg_policy p join pg_class cl on cl.oid = p.polrelid
            where cl.relnamespace = 'public'::regnamespace
               or (not test and cl.oid = 'storage.objects'::regclass)
            order by nsp desc, cl.relname, p.polname loop
    out := out || format('create policy %I on %s.%I as %s for %s to %s%s%s;', r.polname,
             case when r.nsp = 'public' then sch else quote_ident(r.nsp) end, r.relname,
             case when r.polpermissive then 'permissive' else 'restrictive' end,
             case r.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
             r.roles,
             case when r.qual is null then '' else ' using (' || r.qual || ')' end,
             case when r.chk is null then '' else ' with check (' || r.chk || ')' end);
  end loop;

  out := out || E'\n-- ===== Triggers ====='::text;
  for r in select pg_get_triggerdef(t.oid, false) as def from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
            where cl.relnamespace = 'public'::regnamespace and not t.tgisinternal order by cl.relname, t.tgname loop
    out := out || ((case when test then replace(r.def, ' ON public.', ' ON ' || sch || '.') else r.def end) || ';');
  end loop;

  out := out || E'\n-- ===== Grants ====='::text;
  for c in select oid, relname, relkind, relacl from pg_class
            where relnamespace = 'public'::regnamespace and relkind in ('r', 'v', 'm', 'S')
              and (not test or relkind = 'r') order by relkind, relname loop
    tname := format('%s %s.%I', case when c.relkind = 'S' then 'sequence' else 'table' end, sch, c.relname);
    out := out || format('revoke all on %s from public, anon, authenticated, service_role;', tname);
    for r in select case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end as who,
                    string_agg(lower(x.privilege_type), ', ' order by x.privilege_type) as privs
               from aclexplode(c.relacl) x
              where x.grantee <> (select relowner from pg_class where oid = c.oid)
              group by x.grantee loop
      out := out || format('grant %s on %s to %s;', r.privs, tname, r.who);
    end loop;
  end loop;
  if not test then
    for c in select p.oid, p.oid::regprocedure::text as sig, p.proacl, p.proowner from pg_proc p
              where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
                and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                                  and d.objid = p.oid and d.deptype = 'e')
              order by p.proname, p.oid loop
      out := out || format('revoke all on function %s from public, anon, authenticated, service_role;', c.sig);
      if c.proacl is null then
        out := out || format('grant execute on function %s to public;', c.sig);
      else
        for r in select case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end as who
                   from aclexplode(c.proacl) x where x.grantee <> c.proowner and x.privilege_type = 'EXECUTE' loop
          out := out || format('grant execute on function %s to %s;', c.sig, r.who);
        end loop;
      end if;
    end loop;

    out := out || E'\n-- ===== Storage buckets (the files themselves are not in this backup) ====='::text;
    for r in select * from storage.buckets order by id loop
      out := out || format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %L) on conflict (id) do nothing;',
               r.id, r.name, r.public, coalesce(r.file_size_limit::text, 'null'), r.allowed_mime_types);
    end loop;

    out := out || E'\n-- ===== Scheduled jobs (pg_cron) ====='::text;
    for r in select jobname, schedule, command from cron.job order by jobid loop
      out := out || format('select cron.schedule(%L, %L, %L);', r.jobname, r.schedule, r.command);
    end loop;

    out := out || E'\ncommit;'::text;
    out := out || E'\n-- Set the secret settings again (Supabase → SQL Editor):\n--   insert into public.app_settings(key, value) values (''vapid_private'', to_jsonb(''<VAPID private key>''));\n--   insert into public.app_settings(key, value) values (''item_photos_token'', to_jsonb(''<token>''));\n--   insert into public.app_settings(key, value) values (''api_session_secret'', to_jsonb(encode(extensions.gen_random_bytes(48), ''hex'')));'::text;
  end if;

  return array_to_string(out, E'\n') || E'\n';
end
$fn$;

revoke all on function public.rb_backup_sql(text) from public, anon, authenticated;
grant execute on function public.rb_backup_sql(text) to service_role;

create or replace function public.rb_backup_claim(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare v jsonb;
begin
  select value into v from public.app_settings where key = 'backup_link';
  if v is null or p_token is null or (v ->> 'exp')::timestamptz < now() then return false; end if;
  return encode(extensions.digest(p_token, 'sha256'), 'hex') = v ->> 'hash';
end
$fn$;

revoke all on function public.rb_backup_claim(text) from public, anon, authenticated;
grant execute on function public.rb_backup_claim(text) to service_role;
