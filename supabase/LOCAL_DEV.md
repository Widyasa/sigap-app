# Local dev: `auth.uid()` returns NULL after `supabase start`/`db reset`

## Symptom

Any RLS-gated `INSERT`/`UPDATE` keyed on `auth.uid()` (e.g. `complaints_insert_own`,
`aspirations_insert_own`, `votes_insert_own`, and every other `user_id = auth.uid()`
policy in `20260810000006_rls.sql`) fails with:

```
{"code":"42501","message":"new row violates row-level security policy for table \"...\""}
```

...even though the request carries a valid, correctly-signed JWT (verified via
`jwt.io` or `SELECT current_setting('request.jwt.claims', true)` showing the
right `sub`).

## Root cause (local-only, not a repo bug)

This repo never defines `auth.uid()` — grep `supabase/migrations/`, it's only
ever *called*. The function itself ships from the base local Postgres image
(`supabase/postgres:15.8.1.085` at time of writing) and reads the **deprecated
per-claim JWT GUC**:

```sql
select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
```

The local PostgREST image bundled by the Supabase CLI (`supabase/postgrest:v14.16`)
no longer populates that legacy per-claim GUC by default — it only sets the
modern JSON GUC, `request.jwt.claims`. So `auth.uid()` always evaluates to
`NULL` locally, and every `user_id = auth.uid()` check fails.

**Production Supabase Cloud projects are unaffected** — they ship a modern
`auth.uid()` that reads `request.jwt.claims`. This is purely a version-skew
issue between the Postgres and PostgREST images bundled by the local CLI.

Two potential "fix it properly in the repo" routes were tried and ruled out:

- `db-use-legacy-gucs` is a real PostgREST setting, but it is **not exposed**
  via `supabase/config.toml` (confirmed via `supabase config --help`).
- Setting it via in-database role config
  (`ALTER ROLE authenticator SET pgrst.db_use_legacy_gucs = 'true'`) is
  silently ignored — this local stack doesn't run PostgREST in `db-config`
  mode (`PGRST_DB_CONFIG` is absent from the `supabase_rest_*` container env).

There is currently no `config.toml` or migration-level fix, because migrations
run as the `postgres` role, which does not have privileges on the `auth`
schema (`permission denied for schema auth`). Only `supabase_admin` can alter
it, and that role's changes live in the ephemeral local DB — they do **not**
survive `supabase stop`, `supabase start`, or `supabase db reset`, since each
of those recreates the Postgres container from the base image.

## Fix: run this once per local session

After every `supabase start` or `supabase db reset`, run:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -c "
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS \$\$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
\$\$;
"
```

This adds a fallback to the modern JSON GUC without breaking the legacy path,
so it's safe to run against any local Postgres/PostgREST version combo. It is
intentionally not a migration — it patches a Supabase-platform-owned function
outside this repo's schema ownership, and would need re-applying after every
container recreation regardless of where it lived.

Adjust host/port if your `[db].port` in `supabase/config.toml` differs from
the default `54322`.
