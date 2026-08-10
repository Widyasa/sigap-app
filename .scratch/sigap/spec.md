# SIGAP v2.0 — Build Specification

> This spec synthesizes the approved `SIGAP-PRD-v2.0.md` and the domain context agreed during `/grill-with-docs`. It is intended to be picked up by `/implement` or split into tracer-bullet tickets via `/to-tickets`.
>
> Repo decisions already recorded:
> - `npm` stays as the package manager (ADR-0001).
> - Physical directories stay `apps/native` and `apps/web`; the PRD names `apps/mobile` and `apps/admin` are mapped to these.
> - New packages will be created under `packages/shared`, `packages/supabase`, and `packages/ai` using the existing `@repo/*` scope.

---

## Problem Statement

Pemerintah daerah di Indonesia gagal memberikan umpan balik yang jelas kepada warga yang melapor. Aduan masuk lalu senyap, disposisi antar dinas dilakukan manual, aduan duplikat menumpuk, dan warga tidak pernah tahu apakah suaranya mempengaruhi anggaran. SIGAP harus membuat partisipasi publik terasa manfaatnya: laporan sampai ke dinas yang benar, ada bukti progres, aspirasi dapat ditelusuri sampai menjadi mata anggaran, dan panggilan darurat mendapat respons cepat.

## Solution

Bangun SIGAP sebagai aplikasi partisipasi publik berbasis React Native (Expo SDK 51) untuk warga dan dashboard Next.js untuk petugas, dengan Supabase sebagai database/storage/realtime dan Groq/Google AI sebagai kemampuan AI yang seluruhnya dibungkus Edge Function. Autentikasi menggunakan OTP enam digit ke email lewat Resend dan JWT yang ditandatangani sendiri, sehingga tidak bergantung pada Supabase Auth. Otorisasi dijalankan sepenuhnya lewat Row Level Security di PostgreSQL. Semua data disimpan dulu, kemudian diperkaya oleh AI; tidak ada satu pun alur di mana input warga hilang karena AI atau jaringan gagal.

## User Stories

### M0 — Auth & Onboarding

1. Sebagai warga, saya ingin masuk hanya dengan alamat email dan kode enam digit, agar saya tidak perlu mengingat kata sandi baru.
2. Sebagai warga, saya ingin sesi saya bertahan selama 30 hari, agar saya tidak diminta login setiap membuka aplikasi.
3. Sebagai warga yang salah mengetik email, saya ingin bisa mengganti email dari layar verifikasi tanpa menutup aplikasi.
4. Sebagai warga yang belum menyelesaikan profil, saya ingin diarahkan ke onboarding untuk mengisi nama, kecamatan, dan kelurahan, agar aplikasi menampilkan informasi yang relevan.
5. Sebagai warga, saya ingin ada tombol untuk membuka aplikasi email, agar saya tidak bingung saat kode dikirim.
6. Sebagai warga, saya ingin kode OTP dapat diisi otomatis dari notifikasi atau pesan, agar proses masuk lebih cepat.

### M1 — LAPOR

7. Sebagai warga yang menemukan masalah di jalan, saya ingin memotret, menulis satu kalimat, dan mengirim laporan, tanpa harus memilih kategori atau dinas.
8. Sebagai warga, saya ingin tahu laporan saya sampai ke dinas mana dan kapan harus selesai, agar saya merasa didengar.
9. Sebagai warga, saya ingin diberi tahu jika sudah ada laporan serupa di dekat lokasi saya, agar saya bisa mendukung laporan yang ada.
10. Sebagai warga, saya ingin melihat timeline progres laporan dengan foto dan nama petugas, bukan sekadar status teks.
11. Sebagai warga, saya ingin menekan tombol dukung pada laporan orang lain, agar masalah yang sama menjadi lebih prioritas.
12. Sebagai verifikator, saya ingin melihat antrean aduan masuk yang sudah terklasifikasi AI, agar saya bisa memperbaiki dinas atau urgensi dalam satu ketukan.
13. Sebagai verifikator, saya ingin menolak aduan palsu dengan alasan, agar data tetap akurat.
14. Sebagai staf dinas, saya ingin melihat antrean aduan dinas saya yang terurut prioritas dan SLA, agar pekerjaan saya terarah.
15. Sebagai staf dinas, saya ingin menambahkan foto progres dan catatan ke timeline, agar warga melihat bukti penanganan.

### M2 — Aspirasi

16. Sebagai warga, saya ingin mengusulkan pembangunan di kelurahan saya, agar suara saya masuk ke perencanaan.
17. Sebagai warga, saya ingin mendukung aspirasi tetangga di kelurahan saya, agar usulan yang penting naik peringkat.
18. Sebagai warga, saya ingin melihat periode voting aktif dan hitung mundur penutupannya, agar saya tahu waktu berpartisipasi.
19. Sebagai warga, saya ingin menelusuri usulan yang lolos Musrenbang sampai menjadi mata anggaran nyata, agar saya tahu suara saya berpengaruh.
20. Sebagai admin, saya ingin membuka dan menutup periode voting, agar jadwalnya selaras dengan Musrenbang.
21. Sebagai admin, saya ingin menentukan usulan mana yang lolos ke Musrenbang dan menautkannya ke mata anggaran, agar loop tertutup tercipta.

### M3 — Anggaran

22. Sebagai warga, saya ingin melihat visualisasi treemap APBD per dinas, agar saya memahami alokasi anggaran.
23. Sebagai warga, saya ingin melihat rincian program dan kegiatan per dinas, agar saya bisa menelusuri detailnya.
24. Sebagai warga, saya ingin melihat lokasi, foto progres, kontraktor, dan persen realisasi dari sebuah kegiatan, agar saya tahu anggaran benar-benar dipakai.
25. Sebagai warga, saya ingin bertanya kepada AI tentang anggaran dan mendapat jawaban berdasarkan data resmi, agar saya tidak perlu membaca dokumen APBD mentah.

### M4 — Layanan

26. Sebagai warga, saya ingin melihat katalog surat administrasi yang bisa diajukan, agar saya tahu layanan apa yang tersedia.
27. Sebagai warga, saya ingin mengisi formulir permohonan dan mengunggah KTP/KK, agar saya tidak perlu datang ke kantor.
28. Sebagai warga, saya ingin OCR membaca data KTP/KK saya agar formulir terisi otomatis.
29. Sebagai warga, saya ingin melacak status permohonan saya dari diajukan hingga siap diambil.
30. Sebagai warga, saya ingin menerima dokumen hasil dalam bentuk PDF dengan QR verifikasi, agar dokumen dapat dicek keasliannya.

### M5 — Darurat

31. Sebagai warga dalam keadaan darurat, saya ingin menekan dan menahan tombol SOS, agar panggilan darurat terkirim.
32. Sebagai warga, saya ingin memilih jenis darurat setelah tombol SOS aktif, agar operator tahu situasi yang sedang terjadi.
33. Sebagai warga, saya ingin lokasi dan audio 10 detik ikut terkirim saat SOS, agar operator memahami kondisi.
34. Sebagai warga, saya ingin melihat status respons SOS di layar, agar saya tahu bantuan sedang datang.
35. Sebagai operator piket, saya ingin melihat antrean SOS aktif dengan peta dan audio, agar saya bisa merespons dengan cepat.
36. Sebagai operator piket, saya ingin menandai bahwa saya sedang merespons dan menyelesaikan darurat, agar kolega saya tidak dobel tanggapan.

### M6 — Info & Komunitas

37. Sebagai warga, saya ingin melihat pengumuman dari kelurahan atau dinas, agar saya tahu informasi terkini.
38. Sebagai warga, saya ingin melihat leaderboard kelurahan, agar partisipasi komunitas saya menjadi kebanggaan bersama.
39. Sebagai warga, saya ingin melihat poin dan lencana saya, agar saya termotivasi untuk terus berpartisipasi.
40. Sebagai admin, saya ingin poin tercatat sebagai ledger yang dapat diaudit, agar saya bisa membatalkan poin jika laporan terbukti palsu.

## Implementation Decisions

### Architecture

- **No Supabase Auth**: identitas dan sesi dikelola sepenuhnya oleh SIGAP melalui OTP email + JWT yang ditandatangani Edge Function. Seluruh RLS yang sudah didefinisikan di PRD tetap berfungsi karena PostgREST hanya memeriksa tanda tangan JWT, bukan pembuatnya.
- **Aplikasi mobile hanya mengenal Supabase dan Edge Function SIGAP**: semua panggilan ke Groq, Gemini, dan Resend terjadi di Edge Function, sehingga perubahan penyedia tidak memerlukan rilis aplikasi baru.
- **RLS adalah otorisasi tunggal**: pengecekan peran di React Native hanya untuk menyembunyikan tombol; keamanan nyata berada di policy PostgreSQL.
- **Data tidak boleh hilang**: setiap tulis dari aplikasi menyimpan dulu ke database, baru memanggil AI untuk memperkaya; kegagalan AI hanya mengubah status, bukan menghapus data.

### Modules

- **M0 Auth & Onboarding**: login email, OTP, sesi 1 jam + refresh 30 hari, rotasi refresh token, onboarding nama/kelurahan/kecamatan.
- **M1 LAPOR**: pembuatan aduan berfoto + GPS, klasifikasi AI, deteksi duplikat semantik + geografis, timeline realtime, dukungan laporan, countdown SLA.
- **M2 Aspirasi**: usulan, voting per kelurahan dan periode, peringkat Musrenbang, tautan ke mata anggaran.
- **M3 Anggaran**: visualisasi APBD, drill-down per dinas, tanya-jawab AI berbasis RAG.
- **M4 Layanan**: katalog surat, formulir + OCR KTP/KK, pelacakan status, PDF + QR verifikasi.
- **M5 Darurat**: SOS tekan-tahan, GPS + audio 10 detik, antrean prioritas operator, jalur tanpa AI.
- **M6 Info & Komunitas**: pengumuman, leaderboard kelurahan, poin ledger, lencana.

### Edge Functions

- `auth-request-otp`: rate limit di database, cooldown 60 detik, email gagal membatalkan kode.
- `auth-verify-otp`: membuat/ mengambil user + profil, menerbitkan access + refresh token.
- `auth-refresh`: rotasi refresh token, deteksi pemakaian ulang token yang sudah dicabut.
- `auth-signout`: pencabutan perangkat atau seluruh sesi.
- `classify-report`: klasifikasi aduan dengan Groq, perhitungan SLA, deteksi duplikat lewat embedding.
- `embed-text`: embedding lokal `gte-small` 384 dimensi.
- `draft-response`: draf jawaban resmi dinas.
- `ask-budget`: RAG anggaran.
- `ocr-doc`: OCR KTP/KK dengan Gemini vision.
- `dispatch-emergency`: siaran SOS tanpa AI.

### Schema & Data

- Semua tabel menggunakan RLS aktif; `auth_otp_codes` sengaja tidak memiliki policy.
- Uang disimpan sebagai `BIGINT` rupiah penuh.
- Tanggal disimpan sebagai `TIMESTAMPTZ` UTC, ditampilkan dalam zona waktu perangkat.
- Foto aduan, aspirasi, dan progres di bucket publik dengan folder `{user_id}/`; dokumen identitas dan audio SOS di bucket privat dengan signed URL.
- Poin dicatat sebagai ledger di `point_ledger`.

### Design System

- Warna, tipografi, dan spacing berasal dari package shared; tidak ada hex literal di folder aplikasi.
- Body text minimal 16 px, target sentuh minimal 44×44 px.
- Merah hanya untuk darurat dan kesalahan.
- Semua teks antarmuka berbahasa Indonesia; nama variabel dan kolom berbahasa Inggris.

### Package / Directory Mapping

- `apps/native` → aplikasi warga (PRD: `apps/mobile`).
- `apps/web` → dashboard petugas (PRD: `apps/admin`).
- `packages/shared` → design tokens, schemas, constants, domain types.
- `packages/supabase` → SIGAP client factory, query modules.
- `packages/ai` → prompt templates, AI response types.
- Existing `@repo/ui` tetap sebagai library komponen; `@repo/typescript-config` tetap sebagai base tsconfig.

### Dependency Alignment

- `apps/native` akan diturunkan ke Expo SDK 51, React Native 0.74, React 18.2 sesuai matriks kompatibilitas PRD, karena starter yang ada menggunakan versi mayor yang lebih baru dan tidak cocok dengan daftar dependensi PRD.
- `apps/web` akan diturunkan ke Next.js 14.

## Testing Decisions

### Seams

We will test at three seams, chosen because they cover the critical failure modes without duplicating effort:

1. **Database + Edge Function seam** — all migrations, RLS policies, triggers, auth flows, AI classification, and embedding behavior are exercised through `supabase db reset`, Deno tests for pure functions, and `curl` integration tests against locally served Edge Functions. This is the highest-value seam because it validates security and data integrity.
2. **Shared package seam** — design tokens, Zod schemas, constants, and domain utilities are exercised through Vitest. These are pure, fast, and catch contract drift early.
3. **Mobile app behavior seam** — happy paths and failure paths of screens and `useAuth` are exercised on an emulator / real device using the PRD’s verification commands (force stop, token expiry, offline, permission denial). This seam is manual because the PRD defines acceptance criteria that require device runtime (SecureStore, camera, GPS, realtime subscription).

### What makes a good test

- Menguji perilaku eksternal, bukan detail implementasi. Contoh: “pengguna dengan peran citizen tidak dapat mengubah perannya sendiri” diuji lewat policy RLS, bukan lewat membaca kode.
- Setiap logika bisnis murni memiliki unit test yang gagal terlebih dahulu (red-green).
- Setiap Edge Function memiliki test Deno untuk fungsi murni dan minimal satu `curl` untuk kontrak endpoint.
- Setiap perubahan token, rotasi, dan `realtime.setAuth` memiliki test integrasi.
- Semua test wajib lulus sebelum commit (R1 PRD).

### Modules covered by tests

- `packages/shared`: theme, schemas, constants.
- Edge Function shared modules: `jwt.ts`, `otp.ts`, `resend.ts`, `groq.ts`, prompt builders, `parseClassification`, `computeSlaDueAt`.
- Edge Functions: `auth-request-otp`, `auth-verify-otp`, `auth-refresh`, `auth-signout`, `classify-report`, `embed-text`, `ask-budget`, `ocr-doc`, `dispatch-emergency`.
- Mobile: `useAuth`, `useCreateComplaint`, komponen input OTP, screen behavior via acceptance checklist.

## Out of Scope

- OTP SMS (dijadikan jalur tambahan setelah lomba; `profiles.phone` sudah tersedia).
- Obrolan langsung warga–petugas.
- Pembayaran retribusi di dalam aplikasi.
- Aplikasi terpisah untuk petugas; petugas memakai dashboard web.
- Mode luring penuh; hanya cache baca dan antrean kirim.
- Terjemahan bahasa daerah.
- Analitik pihak ketiga yang melacak pengguna.
- Masuk dengan Google / Apple / Facebook.
- Kata sandi dalam bentuk apa pun.
- Multi-factor authentication untuk peran non-citizen (dijadikan prioritas setelah pilot).
- Integrasi SIPD langsung; data APBD masuk melalui impor CSV admin.
- Sertifikat BSrE untuk tanda tangan surat; QR verifikasi sudah cukup.

## Further Notes

- `OTP_DEV_MODE` hanya boleh ada di `supabase/.env.local`; wajib diperiksa sebelum deploy agar tidak bocor ke production.
- `SUPABASE_JWT_SECRET` adalah rahasia paling berbahaya; hanya boleh di Edge Function secrets. Perlu dipastikan apakah proyek Supabase memakai legacy HS256 atau kunci asimetris, karena menentukan cara penandatanganan token.
- Reverse geocode memakai geocoder bawaan OS; tidak ada API key peta berbayar di mobile. Dashboard memakai MapLibre + tile gratis.
- Resend tier gratis memiliki batas 100 email/hari; sesi 30 hari dirancang untuk mengurangi beban ini.
- Semua perubahan pada spesifikasi harus melalui PRD terlebih dahulu, lalu di Sinkronkan ke context docs jika mengubah bahasa domain.
- Setiap task pada PRD Section 13 berakhir dengan satu commit Conventional Commits; tidak menggabungkan dua task dalam satu commit.
