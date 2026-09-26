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
