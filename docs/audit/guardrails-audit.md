# Guardrails Audit — SIGAP (issue #15)

- **Date:** 2026-08-11
- **Scope:** `apps/**`, `packages/**`, `supabase/**`, plus a repo-wide secret scan of
  git-tracked files.

## 1. `supabase.auth` usage

**Command:**

```bash
grep -RIn "supabase\.auth" apps packages supabase docs
```

**Result: zero real usages.** Matches found, all in non-tracked or non-code locations:

| Location | Nature |
|---|---|
| `apps/web/.next/dev/server/chunks/ssr/node_modules_*` and `.next/dev/static/chunks/node_modules_*` | Next.js dev build output bundling `@supabase/auth-js` (a transitive dependency of `@supabase/supabase-js`, used only for its TypeScript client types/URL builder — never invoked). These files live under `apps/web/.next/`, which is gitignored (`apps/web/.gitignore:12: /.next/`) and confirmed untracked (`git ls-files apps/web/.next` → 0 files). |
| `packages/supabase/CONTEXT.md:8` | `_Avoid_: sesi Supabase, supabase.auth.` — this is documentation *warning against* using `supabase.auth`, not a usage. |

No `.ts`/`.tsx` source file anywhere in `apps/`, `packages/`, or `supabase/functions/` calls `supabase.auth.*`. The project's actual auth surface is the custom JWT flow: `auth-request-otp`, `auth-verify-otp`, and `auth-signout` Edge Functions, backed by the `users`/`auth_otp_codes`/`auth_sessions` tables (see `supabase/migrations/20260810000002_identity.sql`) and consumed via `packages/supabase` client helpers (`requestOtp`, `verifyOtp`, custom session/token storage) rather than the Supabase Auth SDK.

**Verdict: PASS.**

## 2. Secrets in committed files

Searched git-tracked files (not gitignored env files) for common secret patterns:

```bash
git grep -nIE "re_[A-Za-z0-9]{10,}|eyJhbGci[A-Za-z0-9._-]{10,}|sk-[A-Za-z0-9]{10,}|SG\.[A-Za-z0-9_-]{10,}"
git grep -nIE "OTP_PEPPER=|SUPABASE_SERVICE_ROLE_KEY=|API_KEY=|JWT_SECRET=|PASSWORD="
git grep -nI "eyJ"                      # raw JWT prefix
git ls-files | grep -E "\.env"          # which env-shaped files are even tracked
```

**Findings:**

| File | Line | Content | Verdict |
|---|---|---|---|
| `SIGAP-PRD-v2.md` | 587-592 | `SUPABASE_JWT_SECRET=isi_dari_perintah_supabase_status`, `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx`, `OTP_PEPPER=hasil_dari_openssl_rand_-hex_32`, `GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx`, `GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxx` | Placeholder instructions in a PRD ("fill from this command", `x`-repeated dummy values) — no real key material. Not a leak. |
| `supabase/functions/.env.example` | 5, 8, 19, 27 | `OTP_PEPPER=change-me-to-a-random-32-byte-hex-string`, `RESEND_API_KEY=re_xxxx...`, `SIGAP_JWT_SECRET=your-project-jwt-secret`, `GEMINI_API_KEY=your-gemini-api-key` | `.env.example` placeholder file, explicitly allowed by the issue spec. Not a leak. |
| `supabase/LOCAL_DEV.md` / `supabase/perf-test-leaderboard.sql` | — | `PGPASSWORD=postgres` | The well-known, publicly documented default local Supabase CLI Postgres password (`postgres`/`postgres` on `127.0.0.1:54322`), used only in local-dev instructions. Not a secret, not a leak. |
| `apps/web/.env.local.example` | 5-6 | `NEXT_PUBLIC_SUPABASE_URL=https://kfbbaeuzvfzcbwjlopne.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_scwzXInxD6edkia43QDjjA_WB5z_b9k` | A Supabase **publishable key** (`sb_publishable_...`, the modern replacement for the legacy `anon` key) is safe-by-design to ship client-side — it has no privileges beyond what RLS grants `anon`/`authenticated`, and Supabase's own docs describe it as non-secret. The file's own comment says as much ("aman dibagikan karena publishable key bukan rahasia"). Not a leak. No `service_role` key appears anywhere in tracked files. |

No raw JWT (`eyJ...`), no `sk-...` key, no `SG....` SendGrid key, and no real `service_role`/pepper/JWT-secret value was found anywhere in git-tracked files. Only two tracked files match `.env*` at all (`apps/web/.env.local.example`, `supabase/functions/.env.example`) — both are `*.example` templates, not the real `.env`/`.env.local` files (both of which are correctly gitignored — see `.gitignore` root entries and `apps/web/.gitignore:28`).

`apps/web/.env.local` (created during issue #14, containing the project's real `NEXT_PUBLIC_SUPABASE_URL`) is confirmed gitignored (`git check-ignore -v apps/web/.env.local` → matched by `apps/web/.gitignore:28`) and untracked. It is not, and should not be, committed.

**Verdict: PASS — no secrets in git-tracked files.**

## 3. RLS audit

See `docs/audit/rls-audit.md` — all 16 `public` tables have RLS enabled; no dangerously permissive write policy found.

## Overall guardrails verdict: **PASS**
