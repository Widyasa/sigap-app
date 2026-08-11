# RLS Audit — SIGAP (issue #15)

- **Date:** 2026-08-11
- **Method:** Static audit of `supabase/migrations/*.sql` (no local Supabase/Postgres
  stack was available in this sandbox — no `docker`/`supabase` CLI binaries; see
  `supabase/LOCAL_DEV.md`). Every `CREATE TABLE`, `ALTER TABLE ... ENABLE ROW LEVEL
  SECURITY`, and `CREATE POLICY` statement across all 16 migration files (through
  `20260812000001_admin_users.sql`) was enumerated and cross-checked table-by-table.
- **Scope:** All base tables (`pg_class.relkind = 'r'`) in schema `public`.

## Tables found (via `CREATE TABLE` grep across migrations)

| # | Table | Migration | RLS enabled? | Policies | Notes |
|---|-------|-----------|--------------|----------|-------|
| 1 | `users` | `20260810000002_identity.sql` | Yes (`20260810000006_rls.sql:1`) | `users_self_read`, `users_admin_read` (SELECT only) | No INSERT/UPDATE/DELETE policy — rows only written by `find_or_create_user()` via service-role key inside an Edge Function. Intentional (custom-auth replacement for `auth.users`). |
| 2 | `auth_otp_codes` | `20260810000002_identity.sql` | Yes (`20260810000006_rls.sql:2`) | **None** | RLS enabled with zero policies = default-deny for every client role (anon/authenticated), including SELECT. Only the service-role key (used inside `auth-request-otp`/`auth-verify-otp` Edge Functions) bypasses RLS entirely and can touch this table. This is the documented, intentional design (see comment at `20260810000006_rls.sql:37-40`) — **not a leak, not a lockout bug**, since no client path ever needs direct access to OTP hashes. |
| 3 | `auth_sessions` | `20260810000002_identity.sql` | Yes (`20260810000006_rls.sql:3`) | `sessions_self_read` (SELECT only, `user_id = auth.uid()`) | No INSERT/UPDATE/DELETE policy — session creation/rotation/revocation only happens via `auth-*` Edge Functions using the service-role key, so token rotation and revocation reasons stay consistent. Intentional. |
| 4 | `dinas` | `20260810000003_core_tables.sql` | Yes | `dinas_read` (public SELECT), `dinas_admin_write` (admin-only ALL) | OK. |
| 5 | `profiles` | `20260810000003_core_tables.sql` | Yes | `profiles_read` (public SELECT), `profiles_self_update` (owner, role locked via `WITH CHECK`), `profiles_admin_all` (admin ALL) | OK. Self-update cannot escalate `role` (`WITH CHECK (... AND role = current_role_name())`). |
| 6 | `complaints` | `20260810000003_core_tables.sql` | Yes | `complaints_read` (public SELECT), `complaints_insert_own`, `complaints_owner_update` (owner, only while status is pre-verification), `complaints_verifier_update`, `complaints_dinas_update` (scoped to `assigned_dinas = current_dinas_id()`) | OK. No unscoped write policy. |
| 7 | `complaint_timeline` | `20260810000003_core_tables.sql` | Yes | `timeline_read` (public SELECT), `timeline_insert` (actor must be self, and either staff role or the complaint's own owner) | OK. |
| 8 | `complaint_upvotes` | `20260810000003_core_tables.sql` | Yes | `upvotes_read` (public SELECT), `upvotes_insert_own`, `upvotes_delete_own` | OK. |
| 9 | `aspirations` | `20260810000004_modules.sql` | Yes | `aspirations_read` (public SELECT), `aspirations_insert_own`, `aspirations_owner_update` (owner, only while status='voting'), `aspirations_admin_update` (admin/dinas_head) | OK. |
| 10 | `aspiration_votes` | `20260810000004_modules.sql` | Yes | `votes_read` (public SELECT), `votes_insert_own` (kelurahan + active-period checks via `EXISTS`), `votes_delete_own` | OK. |
| 11 | `voting_periods` | `20260810000004_modules.sql` | Yes | `periods_read` (public SELECT), `periods_admin` (admin ALL) | OK. |
| 12 | `budget_items` | `20260810000004_modules.sql` | Yes | `budget_read` (public SELECT), `budget_admin_write` (admin ALL) | OK — transparency-by-design table, writes admin-gated. |
| 13 | `service_requests` | `20260810000004_modules.sql` | Yes | `service_owner_read` (owner or staff roles), `service_insert_own`, `service_staff_update` (staff roles only) | OK — private module (KTP/KK-adjacent), no public SELECT policy. |
| 14 | `emergency_alerts` | `20260810000004_modules.sql` | Yes | `emergency_read` (owner or operator/admin), `emergency_insert_own`, `emergency_operator_update` (operator/admin only) | OK — private module, no public SELECT policy. |
| 15 | `point_ledger` | `20260810000004_modules.sql` | Yes | `points_read` (public SELECT) | No INSERT/UPDATE/DELETE policy. As of `20260811000005_points.sql`, rows are written exclusively by `SECURITY DEFINER` triggers (`award_points_complaint_created`, `award_points_complaint_status`, `award_points_upvote`, `award_points_aspiration_musrenbang`) fired on the source tables — these bypass RLS by function ownership, not by a permissive policy. No client (including `authenticated`) can INSERT/UPDATE/DELETE directly. Intentional. |
| 16 | `announcements` | `20260810000004_modules.sql` | Yes | `announcements_read` (public SELECT), `announcements_staff_write` (admin/dinas_head ALL) | OK. |

**Every one of the 16 `public` base tables has `ENABLE ROW LEVEL SECURITY`.** No table was found missing RLS, so **no corrective migration was required** (the anticipated `20260812000002_rls_audit.sql` was not created because there was nothing to fix).

## Tables checked specifically for "created after `20260810000006_rls.sql`"

- `20260810000010_fix_vote_triggers_rls.sql` — no new tables; only redefines `sync_upvote_count()`/`sync_vote_count()` as `SECURITY DEFINER` (fixes a silent 0-row UPDATE bug, does not touch RLS policies or add tables).
- `20260811000001_service_docs_staff_read.sql` — no new tables; adds one `storage.objects` SELECT policy for staff (see Storage section below).
- `20260811000002_verify_service_document.sql` — no new tables; adds a `SECURITY DEFINER` RPC (`verify_service_document`), checked separately below.
- `20260811000003_emergency_audio_operator_read.sql` — no new tables; adds one `storage.objects` SELECT policy for emergency operators.
- `20260811000004_emergency_realtime.sql` — no new tables; realtime publication config only.
- `20260811000005_points.sql` — no new tables; adds `SECURITY DEFINER` triggers on existing tables (see `point_ledger` row above) and a `GRANT SELECT` on the `kelurahan_leaderboard` materialized view + `GRANT EXECUTE` on `refresh_leaderboard()`.
- `20260812000001_admin_users.sql` — no new tables; adds `disable_user(p_user_id, p_disabled)`, a `SECURITY DEFINER` function that checks `current_role_name() = 'admin'` internally before writing `users.disabled_at`, and is only reachable by `authenticated` via explicit `GRANT EXECUTE` (RLS on `users` has no UPDATE policy at all, so this is the only write path — matches the `disable_user`/`current_role_name()` pattern already used elsewhere).

`disable_user` is a **function**, not a table — correctly out of RLS scope, and its own internal role check was verified (raises `42501` unless caller's `current_role_name() = 'admin'`).

## Storage bucket policies (`storage.objects`, not `pg_class` but audited for completeness)

- Public buckets (`complaint-photos`, `progress-photos`, `aspiration-photos`): public SELECT; INSERT restricted to the uploader's own folder (`(storage.foldername(name))[1] = auth.uid()::text`) or, for `progress-photos`, to staff roles.
- Private buckets (`service-docs` — KTP/KK/service docs, `emergency-audio`): **no public SELECT policy**. SELECT is scoped to (a) the uploading owner's own folder, and (b) staff roles (`petugas membaca dokumen layanan`, `verifier`/`dinas_staff`/`dinas_head`/`admin`) for `service-docs`, and emergency operators/admin for `emergency-audio` (`20260811000003_emergency_audio_operator_read.sql`). This matches the PRD requirement that sensitive uploads (KTP/KK, service docs, emergency audio) stay in private buckets with owner/staff-scoped access rather than public URLs.

## Dangerous-policy check

Searched every `CREATE POLICY ... FOR {INSERT|UPDATE|DELETE|ALL}` clause for `USING (true)` / `WITH CHECK (true)` (world-writable). **Zero matches.** Every write-capable policy is gated by `user_id = auth.uid()`, `actor_id = auth.uid()`, an `EXISTS` ownership/membership check, or `current_role_name() IN (...)`. The only `USING (true)` policies in the codebase are `FOR SELECT` (intentionally public-read tables), which is expected and correct.

## "RLS enabled, zero policies" check (intentional lockouts vs. accidental)

Two tables (`auth_otp_codes`, `auth_sessions` for write ops, `users` for write ops, `point_ledger` for write ops) have RLS enabled but are missing INSERT/UPDATE/DELETE policies for `anon`/`authenticated`. In every case this is **documented as intentional** in the migration comments and confirmed by the code audit: the only writers are Edge Functions (`auth-request-otp`, `auth-verify-otp`, `auth-signout`, `find_or_create_user()`) using the Supabase **service-role key**, which bypasses RLS entirely, or `SECURITY DEFINER` functions/triggers that run with the function owner's privileges regardless of caller role. This is a hardening pattern (default-deny + narrow, audited bypass), not a bug — RLS-enabled-with-no-policy means **no client role can access the rows at all**, which is the desired "server-only" posture for OTP hashes, session/refresh-token hashes, and point-ledger writes.

## Conclusion

**PASS.** All 16 `public` base tables have Row Level Security enabled. All write-capable policies are ownership- or role-scoped; no `USING (true)`/`WITH CHECK (true)` write policy exists anywhere in the migration set. The three tables with RLS-enabled-and-no-write-policy (`users`, `auth_otp_codes`, `auth_sessions`) and the one table with RLS-enabled-and-read-only-policy (`point_ledger`) are intentional server-only write paths (service-role key or `SECURITY DEFINER`), not oversights. No new migration was required.
