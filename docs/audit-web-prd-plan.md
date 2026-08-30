# Audit Dashboard Web SIGAP terhadap SIGAP-PRD-v2.md

## Ringkasan Eksekutif

| Modul | Status | Catatan Singkat |
|---|---|---|
| **M0 — Auth/Masuk** | **Deviasi** | Alur OTP email ada, tetapi token disimpan di `localStorage`, halaman login menampilkan `devCode` bila dikembalikan backend, dan pemanggilan `auth-signout` tidak mengirim header `Authorization`. |
| **Ringkasan (`/`)** | **Implemented** | KPI, filter status, beban kategori, kepatuhan SLA, dan panel keputusan tersedia; scope disesuaikan peran (kelurahan/dinas). |
| **M1 — Aduan (`/aduan`)** | **Partial** | Verifikasi & tindak lanjut dinas ada, tetapi verifikator belum bisa menandai duplikat dan kepala dinas belum bisa memindahkan aduan antar dinas. |
| **M2 — Aspirasi (`/aspirasi`)** | **Implemented** | Periode voting, tinjauan aspirasi, penautan item anggaran, serta alur status `voting → musrenbang → approved → budgeted` tersedia. |
| **M3 — Anggaran (`/anggaran`)** | **Partial** | Impor CSV, daftar status indeks, dan pengindeksan ulang ada; validasi `budget_realized > budget_allocated` di impor CSV belum ada. |
| **M4 — Layanan (`/layanan` + `/verify/[code]`)** | **Implemented** | Antrean permohonan, perubahan status, alasan penolakan, pratinjau dokumen bertanda tangan, dan verifikasi publik QR tersedia. |
| **M5 — Darurat (`/darurat`)** | **Implemented** | Antrean SOS realtime, tanggapi, selesai, tandai palsu, serta audio bertanda tangan tersedia. |
| **M6 — Pengumuman & Warga (`/pengumuman`, `/warga`)** | **Implemented** | CRUD pengumuman (dengan target kelurahan), sematkan, refresh leaderboard, dan direktori warga tersedia. |
| **Pengguna (`/pengguna`)** | **Implemented** | Admin dapat mengubah peran, menugaskan dinas, menonaktifkan/mengaktifkan akun. |
| **Design System & Guardrails** | **Deviasi** | Tidak ada hex literal di `apps/web/`, tetapi mode gelap belum diimplementasikan (`colors.light` hardcoded), dan banyak teks/elemen di bawah ukuran minimal PRD (16 px body, 44×44 px target sentuh). |

---

## Daftar Pemeriksaan per Modul

### 1. M0 — Autentikasi & Sesi

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 1.1 | S7/S9 — OTP 6 digit, jeda 60 detik, respons identik untuk email terdaftar/tidak | Halaman login meminta email → kirim kode → halaman verifikasi dengan cooldown | `apps/web/app/login/page.tsx:79-154` memanggil `requestOtp` dan menampilkan hitung mundur `resendIn` | Implemented | — |
| 1.2 | S12 — JWT hanya berisi `sub`, `role: 'authenticated'`, `aud`, `iat`, `exp`; peran domain dibaca dari `profiles` | `AuthProvider` memuat profil setelah verifikasi dan membaca `role`, `dinas_id`, `kelurahan` | `apps/web/app/_lib/auth.tsx:76-117` memuat profil dari tabel `profiles` | Implemented | — |
| 1.3 | 7.6 — `auth-request-otp` hanya boleh mengembalikan `devCode` jika `OTP_DEV_MODE=true` | `devCode` tidak pernah terlihat di UI produksi | `apps/web/app/login/page.tsx:121-123` dan `:134-136` memanggil `setCode(result.devCode ?? '')`, sehingga kode OTP dari respons backend langsung terisi di kolom input | **Deviasi** | **Kode OTP muncul di UI bila backend mengembalikannya**, melanggar kriteria penerimaan M0 #18 dan aturan dev-mode. |
| 1.4 | S11/T9 — refresh token disimpan dengan aman (mobile: SecureStore; access token di memori) | Token disimpan di penyimpanan aman | `apps/web/app/_lib/session.ts:21-39` menyimpan **access token dan refresh token di `localStorage`**, bukan penyimpanan aman | **Deviasi** | **Token staf tersimpan di browser localStorage** — rentan XSS dan tidak memenuhi prinsip S11. |
| 1.5 | 7.2/7.6 — `auth-signout` wajib header `Authorization: Bearer <access token>` | Saat keluar, backend dapat mencabut sesi dengan memverifikasi pemanggil | `apps/web/app/_lib/api.ts:58-63` memanggil `auth-signout` hanya dengan `{refreshToken}` di body, **tanpa header Authorization** | **Deviasi** | **Pemanggilan sign-out tidak terotentikasi**, kemungkinan gagal atau tidak dapat mencabut sesi di server. |
| 1.6 | 7.6 — alur `auth-refresh` memerlukan `apikey` header (contoh curl PRD) | Header `apikey` dikirim ke fungsi publik | `apps/web/app/_lib/session.ts:67-91` `doRefreshAccessToken` hanya mengirim `Content-Type`, tidak ada `apikey` | **Deviasi** | **Kemungkinan ditolak gateway Supabase** (meskipun fungsi publik, PRD menyertakan `apikey` di semua contoh curl). |
| 1.7 | JWT payload PRD (S12) tidak menyertakan `email` | Email staf tetap tersedia setelah muat ulang | `apps/web/app/_lib/auth.tsx:36-39` mencoba membaca klaim `email` dari token, tetapi PRD hanya mensyaratkan `sub`; `loadSession` mengisi `email: getEmailFromToken(...)` sehingga **email kosong setelah reload halaman** | **Deviasi** | **Email staf hilang setelah refresh/muat ulang** karena token tidak membawa klaim email. |
| 1.8 | 8.3 — operator darurat langsung ke `/darurat`, peran lain ke `/` | Redirect berbasis peran setelah login | `apps/web/app/login/page.tsx:21-24` `landingPathForRole` mengarahkan `emergency_operator` ke `/darurat`, lainnya ke `/` | Implemented | — |

### 2. Ringkasan Dashboard (`/`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 2.1 | 8.3 — cakupan data: verifier/admin se-kelurahan, dinas_staff/dinas_head dinas sendiri, emergency_operator versi ringkas | Scope query menyesuaikan peran | `apps/web/app/page.tsx:47-64` `scopeFor` mengembalikan `dinasId` untuk dinas, `kelurahan` untuk verifier/admin | Implemented | — |
| 2.2 | 8.3 — KPI: aduan baru hari ini, menunggu tanggapan, selesai pekan ini, rata-rata respons | Kartu KPI ditampilkan | `apps/web/app/page.tsx:420-455` `KpiRow` merender 4 kartu sesuai definisi | Implemented | — |
| 2.3 | 8.3 — pemetaan status chip: Baru, Diproses, Diteruskan, Selesai, Ditolak | Filter chip mengelompokkan enum `complaint_status` | `apps/web/app/page.tsx:66-76` `STATUS_CHIPS` memetakan ke enum | Implemented | — |
| 2.4 | 8.3 — Beban per kategori & Kepatuhan SLA 7 hari | Panel kategori dan grafik SLA | `apps/web/app/page.tsx:600-703` `CategoryBreakdownPanel` dan `SlaCompliancePanel` | Implemented | — |
| 2.5 | 8.3 — Perlu keputusan: aspirasi `musrenbang` + layanan `verifying` | Panel dengan tombol Setuju/Tolak | `apps/web/app/page.tsx:704-740` `PendingDecisionsPanel`, alasan penolakan wajib diisi | Implemented | — |
| 2.6 | 11.2 — empty state wajib ada ikon, penjelasan, aksi | Setiap daftar kosong memakai `<EmptyState>` | `apps/web/app/_lib/ui.tsx:133-154` `<EmptyState>` selalu punya ikon, judul, pesan, dan slot aksi | Implemented | — |

### 3. M1 — Aduan (`/aduan`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 3.1 | 8.3 — `/verifikasi` dan `/dinas` redirect ke `/aduan` | Route lama redirect | `apps/web/app/verifikasi/page.tsx` dan `apps/web/app/dinas/page.tsx` mengarahkan ke `/aduan?tab=...` | Implemented | — |
| 3.2 | 9.2 — verifikator dapat mengoreksi klasifikasi AI (dinas, kategori, urgensi) | Form koreksi di tab Verifikasi | `apps/web/app/aduan/_verifikasiTab.tsx:190-245` menyediakan dropdown koreksi | Implemented | — |
| 3.3 | 9.2 — verifikator dapat menolak aduan dengan alasan | Modal alasan penolakan | `apps/web/app/aduan/_verifikasiTab.tsx:405-446` `RejectReasonModal` mewajibkan alasan | Implemented | — |
| 3.4 | 9.2 — verifikator dapat menandai duplikat | Tombol/tindakan untuk menandai `duplicate_of` | **Tidak ada UI maupun aksi duplikat** di `_verifikasiTab.tsx` | **Missing** | **Verifikator belum bisa menandai aduan sebagai duplikat.** |
| 3.5 | 9.2/3.2 — staf dinas menambahkan entri timeline dengan foto progres; kepala dinas dapat pindah dinas | Form tindak lanjut dinas | `apps/web/app/aduan/_dinasTab.tsx:82-175` `ComplaintCard` memungkinkan ubah status `verified → in_progress → resolved` dan unggah foto progres | Partial | **Kepala dinas tidak bisa memindahkan aduan ke dinas lain** (PRD 3.2). Hanya perubahan status. |
| 3.6 | RLS — dinas hanya bisa menyentuh aduan `assigned_dinas = current_dinas_id()` | Query dan mutation mematuhi RLS | `apps/web/app/aduan/_dinasTab.tsx:34-70` memanggil `listComplaintsForDinas(supabase, user.dinasId!)`; backend `@repo/supabase` menjalankan RPC/RLS | Implemented | — |

### 4. M2 — Aspirasi (`/aspirasi`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 4.1 | 9.3 — admin buka/tutup periode voting | CRUD periode voting | `apps/web/app/aspirasi/page.tsx:86-253` `VotingPeriodsSection` | Implemented | — |
| 4.2 | 9.3 — admin/`dinas_head` ubah status aspirasi | Dropdown status dengan alur valid | `apps/web/app/aspirasi/page.tsx:254-487` `AspirationReviewSection` memakai `nextAspirationStatuses` | Implemented | — |
| 4.3 | 9.3 — penautan aspirasi ke item anggaran nyata | Pilihan item anggaran | `apps/web/app/aspirasi/page.tsx:350-371` dropdown `budgetOptions` | Implemented | — |
| 4.4 | RLS — periode voting hanya admin yang tulis | Hanya admin melihat form periode | `apps/web/app/aspirasi/page.tsx:119-120` hanya render `VotingPeriodsSection` untuk `role === 'admin'` | Implemented | — |

### 5. M3 — Anggaran (`/anggaran`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 5.1 | 9.4 — admin impor CSV APBD | Form paste CSV dan proses impor | `apps/web/app/anggaran/page.tsx:254-366` `BudgetImportSection` | Implemented | — |
| 5.2 | 9.4 — kolom CSV sesuai spesifikasi | Header kolom sesuai PRD | `packages/shared/src/budgetCsv.ts:27-37` `BUDGET_CSV_COLUMNS` tidak menyertakan `location_lat`, `location_lng` seperti PRD 9.4 | **Deviasi** | **Format CSV dashboard tidak sepenuhnya sesuai PRD** (tidak ada lat/lng). |
| 5.3 | 9.4 #5 — impor menolak baris `budget_realized > budget_allocated` dan melaporkan nomor baris | Parser menolak baris over-realized | `packages/shared/src/budgetCsv.ts:112-126` hanya menolak nilai negatif; **tidak ada cek `budget_realized > budget_allocated`** | **Missing** | **Impor bisa menerima realisasi lebih besar dari pagu tanpa peringatan.** |
| 5.4 | 9.4 — embedding manual pasca-impor | Tombol "Indeks ulang anggaran" | `apps/web/app/anggaran/page.tsx:115-164` memanggil `embedBudgetItemText` per item | Implemented | — |
| 5.5 | 9.4 — tampilan status indeks pencarian semantik | Tabel status indeks | `apps/web/app/anggaran/page.tsx:166-220` tabel program/dinas/status indeks | Implemented | — |

### 6. M4 — Layanan (`/layanan`, `/verify/[code]`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 6.1 | 9.5 — staf dapat memproses permohonan dan mengubah status | Tabel permohonan dengan dropdown status | `apps/web/app/layanan/page.tsx:125-250` `ServiceReviewSection` | Implemented | — |
| 6.2 | 9.5 — penolakan wajib disertai alasan | Modal alasan penolakan | `apps/web/app/layanan/page.tsx:1-30` dan logika `setRejectTarget` | Implemented | — |
| 6.3 | 9.5 — dokumen privat diakses via signed URL | Tautan dokumen dibuka via signed URL | `apps/web/app/layanan/page.tsx:70-94` `handleViewDocuments` memanggil `getServiceRequestSignedUrl` | Implemented | — |
| 6.4 | 9.5 — QR verifikasi publik tanpa login | Halaman publik menampilkan keabsahan | `apps/web/app/verify/[code]/page.tsx:1-203` menampilkan jenis, status, tanggal terbit; tidak menampilkan NIK/alamat | Implemented | — |

### 7. M5 — Darurat (`/darurat`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 7.1 | 9.6 — operator melihat antrean SOS realtime | Subscription realtime + daftar alert | `apps/web/app/darurat/page.tsx:70-140` subscribe channel `emergency-queue` | Implemented | — |
| 7.2 | 9.6 — operator dapat tanggapi, selesai, tandai palsu | Tombol aksi dengan konfirmasi | `apps/web/app/darurat/page.tsx:304-410` `AlertCard` | Implemented | — |
| 7.3 | 9.6 — audio diakses via signed URL | Tombol putar audio | `apps/web/app/darurat/page.tsx:186-203` `getEmergencyAlertSignedAudioUrl` | Implemented | — |
| 7.4 | 9.6 — status warga hanya miliknya, operator/admin semua | Role gate di halaman | `apps/web/app/darurat/page.tsx:36-40` `OPERATOR_ROLES` | Implemented | — |

### 8. M6 — Pengumuman & Warga

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 8.1 | 9.7 — admin/dinas_head kelola pengumuman | CRUD pengumuman dengan target kelurahan/semua | `apps/web/app/pengumuman/page.tsx:1-623` `AnnouncementsSection` | Implemented | — |
| 8.2 | 9.7 — pengumuman dapat disematkan | Checkbox sematkan | `apps/web/app/pengumuman/page.tsx:101-110` `isPinned` | Implemented | — |
| 8.3 | 9.7 — refresh leaderboard kelurahan | Tombol segarkan peringkat | `apps/web/app/pengumuman/page.tsx:390-446` `LeaderboardSection` memanggil `refreshLeaderboard` | Implemented | — |
| 8.4 | 8.3 — direktori warga per kelurahan | Tabel warga dengan poin & kontribusi | `apps/web/app/warga/page.tsx:1-216` menampilkan direktori berdasarkan `user.kelurahan` | Implemented | — |

### 9. Pengguna (`/pengguna`)

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 9.1 | 3.2/S4 — admin mengelola peran dan dinas | Dropdown peran & dinas, konfirmasi modal | `apps/web/app/pengguna/page.tsx:1-303` tabel peran dengan konfirmasi | Implemented | — |
| 9.2 | 3.2 — admin nonaktifkan/aktifkan akun | Toggle status akun | `apps/web/app/pengguna/page.tsx:131-147` `applyDisable` | Implemented | — |

### 10. Design System, UX Writing & Guardrails

| No | Kebutuhan PRD | Perilaku yang Diharapkan | Implementasi Aktual | Status | Celah/Deviasi |
|---|---|---|---|---|---|
| 10.1 | R4 — tidak ada hex literal di `apps/` | Semua warna dari `@repo/shared` | Pemeriksaan manual tidak menemukan `#RRGGBB` di file `apps/web/` kecuali di `global.css` untuk `focus-visible` halo (diperbolehkan karena CSS reset) | Implemented | — |
| 10.2 | 5.2/5.4 — komponen mendukung mode gelap via `useColorScheme()` | Warna menyesuaikan tema perangkat | **Seluruh file `apps/web/app/**/page.tsx` dan `_lib/*.tsx` memakai `const THEME = colors.light`** | **Deviasi** | **Mode gelap dashboard belum diimplementasikan.** |
| 10.3 | 5.3 — body text minimal 16 px, target sentuh minimal 44×44 px | Teks isi dan tombol memenuhi ukuran minimal | Banyak teks 12–14 px dan tombol `minHeight: 32–36 px` (mis. `apps/web/app/aspirasi/page.tsx:247` `smallButtonStyle` `minHeight: 36`; `apps/web/app/aduan/_verifikasiTab.tsx:424` `buttonStyle` `minHeight: 36`) | **Deviasi** | **Body text dan target sentuh sering di bawah ambang PRD.** |
| 10.4 | 10.2/10.3 — seluruh antarmuka berbahasa Indonesia | Teks UI dalam bahasa Indonesia | Semua label, pesan error, dan empty state menggunakan bahasa Indonesia | Implemented | — |
| 10.5 | 11.2 — empty state punya ikon, penjelasan, aksi | `<EmptyState>` konsisten | `apps/web/app/_lib/ui.tsx:133-154` memakai pola ikon+judul+pesan+aksi | Implemented | — |
| 10.6 | 12.4 — `supabase.auth.*` tidak dipakai | Auth kustom | `apps/web/app/_lib/auth.tsx` tidak mengimpor `supabase.auth.*` | Implemented | — |

---

## 10 Celah Kritis (Terurut Prioritas)

1. **OTP `devCode` muncul di input login**
   - **File:** `apps/web/app/login/page.tsx:121-123` dan `:134-136`
   - **Masalah:** `setCode(result.devCode ?? '')` mengisi kode OTP dari respons backend langsung ke kolom input. Jika backend mengembalikan `devCode` di luar mode pengembangan, kode OTP terlihat di layar.
   - **Dampak:** Pelanggaran kriteria penerimaan M0 #18 dan potensi kebocoran kode OTP.

2. **Token sesi staf disimpan di `localStorage`**
   - **File:** `apps/web/app/_lib/session.ts:21-39`
   - **Masalah:** Access token dan refresh token disimpan di `localStorage`, bukan penyimpanan aman; access token seharusnya hanya di memori.
   - **Dampak:** Rentan terhadap serangan XSS; sesi staf bisa dicuri oleh skrip pihak ketiga.

3. **`auth-signout` tidak mengirim header `Authorization`**
   - **File:** `apps/web/app/_lib/api.ts:58-63`
   - **Masalah:** Pemanggilan `auth-signout` hanya mengirim `refreshToken` di body tanpa header `Authorization: Bearer <access token>`.
   - **Dampak:** Edge Function `auth-signout` memerlukan identitas pemanggil (PRD 7.6 langkah 1); tanpanya, sesi mungkin tidak tercabut di server.

4. **Email staf hilang setelah reload halaman**
   - **File:** `apps/web/app/_lib/auth.tsx:36-39`, `:108-117`
   - **Masalah:** `getEmailFromToken` membaca klaim `email` yang tidak ada dalam JWT PRD (hanya `sub`, `role`, `aud`, `iat`, `exp`).
   - **Dampak:** Setelah reload, `StaffProfile.email` kosong; dapat memengaruhi tampilan subjudul dan log audit.

5. **Mode gelap tidak diimplementasikan**
   - **File:** `apps/web/app/page.tsx:13`, `apps/web/app/aduan/page.tsx:10`, `apps/web/app/login/page.tsx:10`, dsb.
   - **Masalah:** Semua komponen memakai `const THEME = colors.light`.
   - **Dampak:** Tidak sesuai design system PRD 5.2 dan dapat mengurangi aksesibilitas pada perangkat dengan preferensi gelap.

6. **Target sentuh dan teks isi sering di bawah minimal PRD**
   - **File:** `apps/web/app/aspirasi/page.tsx:247`, `apps/web/app/aduan/_verifikasiTab.tsx:424`, `apps/web/app/_lib/ui.tsx:355-366`
   - **Masalah:** Banyak tombol `minHeight: 32–36 px` dan teks 12–14 px.
   - **Dampak:** Melanggar PRD T3 (target sentuh ≥44×44 px) dan 5.3 (body text ≥16 px).

7. **Verifikator belum bisa menandai aduan duplikat**
   - **File:** `apps/web/app/aduan/_verifikasiTab.tsx`
   - **Masalah:** Tidak ada aksi untuk mengisi `complaints.duplicate_of` atau membuat `complaint_upvotes` sebagai hasil duplikat.
   - **Dampak:** Kriteria penerimaan M1 terkait deteksi/penanganan duplikat tidak terpenuhi di dashboard.

8. **Kepala dinas tidak bisa memindahkan aduan antar dinas**
   - **File:** `apps/web/app/aduan/_dinasTab.tsx`
   - **Masalah:** Hanya ada perubahan status `verified → in_progress → resolved` dan unggah foto progres.
   - **Dampak:** Kewenangan `dinas_head` di PRD 3.2 (memindahkan aduan ke dinas lain) belum tersedia.

9. **Impor CSV anggaran tidak menolak `budget_realized > budget_allocated`**
   - **File:** `packages/shared/src/budgetCsv.ts:112-126`
   - **Masalah:** Parser hanya memeriksa nilai negatif dan rentang `progress_percent`.
   - **Dampak:** Data anggaran bisa mengandung realisasi yang melebihi pagu, melanggar kriteria penerimaan M3 #5.

10. **Format CSV impor anggaran tidak sesuai spesifikasi PRD**
    - **File:** `packages/shared/src/budgetCsv.ts:27-37`
    - **Masalah:** Kolom `location_lat` dan `location_lng` tidak ada di `BUDGET_CSV_COLUMNS`, padahal PRD 9.4 menyebutkannya.
    - **Dampak:** CSV yang disusun sesuai PRD akan gagal diimpor atau kolom koordinat akan diabaikan.

---

## Skenario Uji E2E Playwright

| No | Peran | Rute | Aksi Utama | Asersi |
|---|---|---|---|---|
| 1 | Admin | `/login` | Masukkan email, klik "Kirim Kode OTP", isi kode (mock), klik "Verifikasi" | URL menjadi `/`; sidebar menampilkan nama admin dan peran "Admin". |
| 2 | Warga (`citizen`) | `/` | Login sebagai warga | URL dialihkan ke `/login?alasan=bukan_petugas`; tidak muncul KPI/dashboard. |
| 3 | Verifikator | `/` | Muat halaman ringkasan | Terlihat kartu "Aduan baru hari ini", "Menunggu tanggapan", "Selesai pekan ini", "Rata-rata respons"; tabel aduan muncul. |
| 4 | Verifikator | `/aduan?tab=verifikasi` | Pilih aduan `pending`, ubah dinas/kategori/urgensi, klik "Koreksi Klasifikasi" | Muncul pesan sukses; daftar dimuat ulang; status aduan berubah sesuai koreksi. |
| 5 | Verifikator | `/aduan?tab=verifikasi` | Klik "Tolak" pada aduan, isi alasan, klik "Konfirmasi" | Modal tertutup; daftar diperbarui; aduan tidak lagi muncul di antrean. |
| 6 | Staf Dinas | `/aduan?tab=dinas` | Pada aduan `verified`, klik "Tindak Lanjut", unggah foto progres, klik "Simpan" | Status aduan menjadi `in_progress`; foto progres tersimpan. |
| 7 | Admin | `/aspirasi` | Buka periode voting baru; kemudian ubah status aspirasi `musrenbang → approved` dan tautkan item anggaran | Periode muncul di daftar; status aspirasi berubah dan item anggaran tertaut. |
| 8 | Admin | `/anggaran` | Tempel CSV valid, klik "Impor CSV" | Muncul jumlah item berhasil diimpor; item muncul di tabel status indeks. |
| 9 | Verifikator | `/layanan` | Pilih permohonan `verifying`, ubah status ke `signing`, klik "Terbitkan PDF" | Status menjadi `signing`; PDF berhasil diterbitkan; QR verifikasi dapat dipindai di `/verify/[code]`. |
| 10 | Operator Darurat | `/darurat` | Saat alert SOS aktif tersedia, klik "Tanggapi" | Status alert menjadi `responding`; nama operator muncul; setelah "Selesai", alert hilang dari antrean. |
| 11 | Admin | `/pengguna` | Ubah peran pengguna uji menjadi `dinas_staff` dan pilih dinas, klik "Ubah Peran" | Muncul pesan sukses; tabel memperbarui peran dan dinas; pengguna tidak bisa lagi mengakses halaman admin. |
| 12 | Verifikator | `/warga` | Muat halaman direktori warga | Tabel menampilkan warga di kelurahan verifikator; total warga dan total poin kumulatif terlihat. |

---

## Catatan Audit

- Audit ini hanya mencakup kode di `apps/web/` dan file `packages/shared/src/theme.ts` serta `packages/shared/src/budgetCsv.ts` yang menjadi acuan pelanggaran desain/validasi.
- Semua pernyataan di atas didasarkan pada pembacaan kode; belum diuji dengan menjalankan aplikasi. Skenario Playwright disarankan untuk mengonfirmasi perilaku runtime, terutama untuk celah keamanan dan alur status.
- Tidak ada perubahan kode yang dilakukan selama audit ini.
