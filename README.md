# SIGAP

**Sistem Informasi Gerakan Aspirasi & Pelayanan** — a civic-tech reporting and transparency
platform connecting citizens and city staff across six modules: aduan (complaints), aspirasi
(budget proposals), layanan (administrative services), darurat (SOS emergency), pengumuman
(announcements), and anggaran (budget transparency). See [`SIGAP-PRD-v2.md`](./SIGAP-PRD-v2.md)
for the full product spec (Bahasa Indonesia).

The citizen-facing app is a React Native (Expo) app; city staff use a Next.js dashboard. Both
share a typed Supabase data layer and a design system package. UI copy is Indonesian; code,
comments, and this README are in English.

## Monorepo structure

| Path | What it is |
|---|---|
| `apps/native` | Citizen mobile app — Expo (SDK 55), Expo Router |
| `apps/web` | Staff dashboard — Next.js 16 |
| `packages/shared` | Design tokens/theme, domain constants, validation schemas (zero-hex-literal color rule lives here) |
| `packages/supabase` | Typed Supabase client, domain queries/mutations, session/RLS conventions |
| `packages/ui` | Shared UI components (native + web) |
| `packages/ai` | AI prompt contracts and response/failure handling |
| `packages/typescript-config` | Shared `tsconfig.json` bases |
| `supabase/` | Migrations, seed data, edge functions, local dev stack config |

## Prerequisites

- **Node 24** — pinned in [`.node-version`](./.node-version). Use `nvm`/`fnm`/`asdf` or equivalent.
- **npm ≥ 11** — root `package.json` declares `devEngines.packageManager` requiring
  `npm@^11.0.0`. This is enforced strictly: running any npm command (`npm install` included)
  with an older npm (e.g. the npm 10.x that ships with some Node installs) fails with
  `EBADDEVENGINES`. Run `npm install -g npm@latest` first, or use a Node version manager /
  Corepack that resolves a matching npm.
- **Supabase CLI** — required for local Supabase development (`supabase start`, `db reset`,
  `functions serve`). See [`supabase/LOCAL_DEV.md`](./supabase/LOCAL_DEV.md).

## Environment variables

None of these files are committed. Copy each `.example` template and fill in real values.

| App | File to create | From template | Purpose |
|---|---|---|---|
| `apps/native` | `apps/native/.env.local` | — (no example file; see vars below) | Supabase client config, inlined into the Expo/Metro bundle |
| `apps/web` | `apps/web/.env.local` | `apps/web/.env.local.example` | Supabase client config for the dashboard |
| Edge functions | `supabase/functions/.env` | `supabase/functions/.env.example` | Secrets for local `supabase functions serve` |

**`apps/native/.env.local`** only needs the two `EXPO_PUBLIC_*`-prefixed vars — those are the
ones Expo actually inlines into the app bundle at build time:

```
EXPO_PUBLIC_SUPABASE_URL=              # Supabase project API URL (Project Settings → API)
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Supabase publishable key (Project Settings → API) — safe to share
```

> **Note:** the `.env.local` observed in this working copy also has a full copy of the edge
> function secrets (`OTP_PEPPER`, `RESEND_API_KEY`, `SIGAP_JWT_SECRET`, etc.) appended below the
> two vars above. Those are unused by any `apps/native` code — only `supabase/functions/*`
> consumes them — so that's leftover/convenience copy-paste in this checkout, not a documented
> requirement. Don't treat it as the pattern to follow.

**`apps/web/.env.local`** (copy from `apps/web/.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=              # same Supabase project URL as above
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # same Supabase publishable key as above
```

A stale `.env.local` also exists at the **repo root** with the same two `NEXT_PUBLIC_*` values.
Next.js only reads env files from the app's own directory (`apps/web/`), never from a monorepo
parent, so the root-level file is not consumed by anything — `apps/web/.env.local` is the one
that matters.

**`supabase/functions/.env`** (copy from `supabase/functions/.env.example`, which has detailed
per-var comments — summary below):

| Var | Purpose | Where to get it |
|---|---|---|
| `OTP_PEPPER` | Random secret used to hash OTP/refresh tokens | Generate a random 32-byte hex string yourself |
| `RESEND_API_KEY` | Sends OTP emails | [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | Sender address for OTP emails | Must be from a domain verified in Resend (see `scripts/setup-resend-domain.sh`) |
| `OTP_DEV_MODE` | If `true`, returns the OTP code in the API response instead of only emailing it | Local dev only — leave `false`/unset in production |
| `SIGAP_JWT_SECRET` | Signs/verifies session JWTs so PostgREST can validate them | Supabase project JWT secret (dashboard), or any local value for local dev |
| `SIGAP_SERVICE_ROLE_KEY` | Service-role key for privileged edge function operations | Production: Supabase's built-in service role key. Local: a service_role JWT signed with your local `SIGAP_JWT_SECRET` (the CLI's default key uses a different secret) |
| `GEMINI_API_KEY` | AI classification of aduan (`classify-report`) | [Google AI Studio](https://aistudio.google.com/) |
| `GEMINI_MODEL` / `GEMINI_MODEL_LIGHT` | Model names for heavier/lighter Gemini calls | Defaults shown in `.env.example` are usually fine |

## Local development

```sh
npm install          # from repo root, once npm ≥ 11 is active
```

**Native app** (from repo root or `apps/native/`):

```sh
npm run dev --workspace=apps/native   # expo start --web, headless
# or, inside apps/native/:
npm run go        # Expo Go, LAN host — scan the QR code on a device
npm run android    # expo run:android
npm run ios        # expo run:ios
```

**Web dashboard** (from repo root or `apps/web/`):

```sh
npm run dev --workspace=apps/web      # next dev
```

**Supabase (local backend)** — start the local stack, apply migrations/seed, and serve edge
functions with the Supabase CLI. Before doing any local Supabase work, read
[`supabase/LOCAL_DEV.md`](./supabase/LOCAL_DEV.md) — it documents two non-obvious, local-only
gotchas (a stale `auth.uid()` GUC that must be re-applied after every `supabase start`/`db
reset`, and a realtime RLS limitation) that will otherwise look like real bugs.

## Common scripts

Root (via Turborepo, runs across all workspaces):

| Script | Does |
|---|---|
| `npm run dev` | `turbo run dev` — starts dev servers for every app |
| `npm run build` | `turbo run build` |
| `npm run test` | `turbo run test` (currently implemented in `packages/shared`, `packages/supabase`) |
| `npm run typecheck` | `turbo run typecheck` |
| `npm run clean` | `turbo run clean` + removes `node_modules` |
| `npm run format` | `prettier --write` across the repo |

`apps/native`: `dev`, `go`, `android`, `ios`, `web`, `typecheck`, `eject`
`apps/web`: `dev`, `build`, `start`, `lint`, `typecheck`

Use `npm run <script> --workspace=apps/native` (or `apps/web`) to target one app, or `cd` into
the app directory and run its scripts directly.

## Deployment

- **Android (native app):** see [`apps/native/EAS_BUILD.md`](./apps/native/EAS_BUILD.md) for the
  EAS preview build hand-off (internal distribution APK, no Play Store submission).
- **Web dashboard:** a `vercel.json` exists at the repo root (build/output/install commands for
  Turborepo-filtered builds), but Vercel deployment is **not yet completed** — set up is in
  progress. Don't treat it as a live/verified deployment path yet.
- **Email domain (Resend):** `scripts/setup-resend-domain.sh` is an interactive wizard that
  walks through verifying a sending domain in Resend, required for `EMAIL_FROM` in production.

## Where to look next

- [`SIGAP-PRD-v2.md`](./SIGAP-PRD-v2.md) — full product requirements and build spec (Bahasa Indonesia)
- [`CLAUDE.md`](./CLAUDE.md) — agent/contributor conventions and skill pointers
- [`CONTEXT-MAP.md`](./CONTEXT-MAP.md) — per-context `CONTEXT.md` docs for each app/package
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/agents/`](./docs/agents/) — issue tracking, triage labels, domain doc conventions
- [`docs/audit/`](./docs/audit/) — RLS and guardrails audit notes
- [`supabase/LOCAL_DEV.md`](./supabase/LOCAL_DEV.md) — required reading before local Supabase work
