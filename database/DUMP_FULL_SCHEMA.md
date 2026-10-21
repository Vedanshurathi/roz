# Full database backup (structure + data) — the easy way (since 1 Oct 2026)

The database can write its own complete backup as one `.sql` file: `public.rb_backup_sql()`
(migration `migrations/20261001a_backup_export.sql`). It contains every table, view, function,
trigger, policy, grant, cron job and storage-bucket setting, all app data and the login accounts —
but **not** secret settings, Storage files or Edge Function code. Restoring it into a scratch schema was
tested (all 2,770 rows, 116 constraints, 89 indexes, 37 policies, 16 triggers matched).

**Get a download link** (Supabase → SQL Editor), valid 24 hours:

```sql
with tok as (select encode(extensions.gen_random_bytes(32), 'hex') as t)
insert into public.app_settings(key, value, updated_at)
select 'backup_link', jsonb_build_object('hash', encode(extensions.digest(t, 'sha256'), 'hex'),
       'exp', now() + interval '24 hours'), now() from tok
on conflict (key) do update set value = excluded.value, updated_at = now()
returning (select t from tok) as token;
```

Then open `https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/rb-backup?t=<token>` in the browser.
The file has personal data: keep it private, never put it in this (public) repo.

---

# Getting the full SQL (every function body, policy, trigger)

`SCHEMA.md` lists everything that exists. To get the actual source of all 124
functions, the RLS policies and triggers as a real `.sql` file, dump it from the
live project. Do this once at the start and commit it — after that, every
database change should be a new migration file in `database/migrations/`.

## Option A — Supabase CLI (recommended)

```bash
npm install -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref srvpfyjmwaruebbkqkdj   # asks for the DB password

# schema only (tables, views, functions, policies, triggers)
supabase db dump --linked -f database/schema.sql

# optional: current data, for a local copy
supabase db dump --linked --data-only -f database/data.sql
```

The DB password is in Supabase Dashboard → Project Settings → Database.
Never commit `data.sql` to a public repo — it has customer phone numbers.

## Option B — one function at a time (via SQL editor or Supabase MCP)

```sql
select pg_get_functiondef('public.customer_create_booking'::regproc);
```
If the function is overloaded (shouldn't be — see CLAUDE.md), use the full
signature: `'public.admin_update_product(uuid,numeric,boolean,text,text,text,text)'::regprocedure`.

## Sanity checks to run after ANY migration

```sql
-- 1. No accidental overloads (must return zero rows)
select proname, count(*) from pg_proc
where pronamespace = 'public'::regnamespace
group by proname having count(*) > 1;

-- 2. The function you changed actually has the new body
select pg_get_functiondef('public.<name>'::regproc);
```
