# PRD Definition of Done — SIGAP

This checklist is the acceptance bar for every SIGAP module/issue (parent #1, issues
#2-#15). An issue is not "done" until every applicable item below is checked.

## Per-issue Definition of Done

- [ ] **Typecheck.** `npx turbo run typecheck` passes workspace-wide (all packages
      under `apps/*` and `packages/*`), no `@ts-ignore`/`@ts-expect-error` added to
      silence a real type error.
- [ ] **Tests.** `npx turbo run test` passes for every package that ships tests
      (currently `packages/shared`, `packages/supabase`); no test skipped or
      deleted to make the suite pass.
- [ ] **No `supabase.auth` usage.** The project uses custom JWT auth
      (`auth-request-otp`, `auth-verify-otp`, `auth-signout` Edge Functions +
      `users`/`auth_otp_codes`/`auth_sessions` tables). `supabase.auth.*` must not
      appear in any tracked file under `apps/**`, `packages/**`, or
      `supabase/functions/**`.
- [ ] **No secrets in committed source.** No API key, JWT secret, service-role key,
      Resend key, OTP pepper, or password value in a git-tracked file. Real values
      live only in `.env` / `.env.local` (gitignored) or Supabase project secrets.
      `.env.example` / `.env.local.example` may contain placeholders only.
- [ ] **RLS enabled on every table.** Every `public` base table has
      `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Every write-capable policy
      (`INSERT`/`UPDATE`/`DELETE`/`ALL`) is scoped by ownership
      (`user_id = auth.uid()`), role (`current_role_name() IN (...)`), or an
      explicit `EXISTS` relationship check — never `USING (true)` /
      `WITH CHECK (true)`. A table with RLS enabled and zero policies is
      acceptable only when documented as an intentional server-only write path
      (service-role key or `SECURITY DEFINER` function/trigger).
- [ ] **Private storage for sensitive uploads.** KTP/KK and other service
      documents (`service-docs` bucket) and emergency audio (`emergency-audio`
      bucket) live in **private** Supabase Storage buckets, readable only by the
      uploading owner and the relevant staff roles via RLS-gated `storage.objects`
      policies — never a public bucket or a signed-URL-free public path. Public
      buckets (`complaint-photos`, `progress-photos`, `aspiration-photos`) are
      reserved for non-PII photos only.
- [ ] **RLS-bypassing edge functions/RPCs verify identity internally.** Any
      Edge Function or Postgres function that uses the service-role key or
      `SECURITY DEFINER` to bypass RLS must verify the caller's JWT
      (`verifyAccessToken`) or role (`current_role_name()`) inside its own logic
      before acting — it must never be reachable by an anonymous caller performing
      a privileged write without that check.
- [ ] **Manual walkthrough.** Every module has at least one manual walkthrough
      (Expo web and/or the Next.js dashboard) exercising its acceptance criteria,
      recorded as evidence on the issue/PR.
- [ ] **One issue = one PR.** Each issue ships as its own PR with an evidence
      table (what was built, how it was verified); self-merge only happens after
      review.

## Audit status for this repo (issues #9-#15)

As of this audit (2026-08-11, issue #15):

| Item | Status | Evidence |
|---|---|---|
| Typecheck | ✅ PASS | `npx turbo run typecheck` — 8/8 tasks successful |
| Tests | ✅ PASS | `npx turbo run test` — 5/5 test-bearing tasks successful, 65 tests passed (`packages/shared`: 56, `packages/supabase`: 9) |
| No `supabase.auth` usage | ✅ PASS | `docs/audit/guardrails-audit.md` §1 |
| No secrets committed | ✅ PASS | `docs/audit/guardrails-audit.md` §2 |
| RLS on every table | ✅ PASS | `docs/audit/rls-audit.md` — all 16 `public` tables covered |
| Private buckets for sensitive uploads | ✅ PASS | `docs/audit/rls-audit.md` Storage section — `service-docs`, `emergency-audio` are private, owner/staff-scoped |
| RLS-bypassing functions verify identity | ✅ PASS | `find_or_create_user`, `disable_user`, `award_points_*` triggers, `refresh_leaderboard`, `verify_service_document` all audited in `docs/audit/rls-audit.md` |
| Manual walkthroughs | Tracked per-issue on GitHub (#9-#14), not re-verified here (this issue is a static code/SQL audit per its own instructions) | — |
| One issue = one PR | Tracked via repo PR history, out of scope for this static audit | — |

**Conclusion: all code-auditable Definition of Done criteria for issue #15 (typecheck,
tests, RLS, no `supabase.auth`, no leaked secrets) are satisfied. Parent issue #1's
child issues #9-#14 are covered by this final integration audit.**
