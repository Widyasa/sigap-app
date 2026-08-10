# Context Map

## Contexts

- [Mobile Citizen App](./apps/native/CONTEXT.md) — aplikasi warga untuk membuat aduan, aspirasi, layanan, SOS, dan melihat informasi publik.
- [Admin Dashboard](./apps/web/CONTEXT.md) — dashboard petugas untuk verifikator, dinas, operator darurat, dan admin.
- [Shared Design & Schemas](./packages/shared/CONTEXT.md) — token desain, skema validasi, konstanta domain, dan tipe lintas aplikasi.
- [Supabase Client & Queries](./packages/supabase/CONTEXT.md) — klien SIGAP, query domain, dan konvensi sesi/RLS.
- [AI Contracts & Prompts](./packages/ai/CONTEXT.md) — kontrak prompt, respons AI, dan jalur kegagalan.

## Directory mapping

| Context | Physical directory | Notes |
|---|---|---|
| Mobile Citizen App | `apps/native` | PRD calls this `apps/mobile`. |
| Admin Dashboard | `apps/web` | PRD calls this `apps/admin`. |
| Shared Design & Schemas | `packages/shared` | New package; uses `@repo/*` scope along with existing packages. |
| Supabase Client & Queries | `packages/supabase` | New package. |
| AI Contracts & Prompts | `packages/ai` | New package. |

## Relationships

- **Mobile Citizen App ↔ Admin Dashboard**: Both consume `Shared Design & Schemas` for UI tokens, Zod schemas, and domain constants.
- **Mobile Citizen App ↔ Supabase Client & Queries**: The mobile app uses the SIGAP client and domain queries to talk to Supabase.
- **Admin Dashboard ↔ Supabase Client & Queries**: The dashboard uses the same SIGAP client and queries.
- **Supabase Client & Queries → AI Contracts & Prompts**: Edge Function code in the Supabase context imports prompt contracts and types from the AI context.
- **Mobile Citizen App → AI Contracts & Prompts**: The mobile app does not talk to AI directly; it invokes Edge Functions whose contracts are described in the AI context.
