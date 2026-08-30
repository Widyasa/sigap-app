# Laporan Audit E2E Dashboard Web SIGAP terhadap SIGAP-PRD-v2.md

Laporan ini menyimpulkan hasil audit Playwright E2E untuk aplikasi dashboard Next.js di `apps/web/` berdasarkan pemetaan PRD-ke-kode di `docs/audit-web-prd-plan.md`. Audit hanya membaca kode dan menjalankan tes; tidak ada perubahan kode yang dilakukan.

---

## Ringkasan Eksekutif

Pengujian final menghasilkan **28 tes total**: **16 lulus**, **5 gagal**, dan **7 dilewati** (durasi ≈150 detik, 1 worker). Secara fungsional dashboard telah mengimplementasikan sebagian besar modul inti PRD—autentikasi OTP, ringkasan, aspirasi, anggaran, layanan, darurat, pengumuman, warga, dan pengelolaan pengguna. Namun, terdapat **deviasi keamanan dan desain** serta **beberapa aksi admin yang belum tersedia**, yaitu:

- Token sesi staf disimpan di `localStorage` dan pemanggilan `auth-signout` tidak mengirim header `Authorization`.
- Halaman login mem-prefill kode OTP bila backend mengembalikan `devCode`.
- Klaim `email` hilang dari JWT, sehingga email staf kosong setelah muat ulang.
- Mode gelap PRD belum diimplementasikan; seluruh halaman memakai `colors.light`.
- Banyak target sentuh dan teks isi di bawah ambang minimal PRD (44×44 px dan 16 px).
- Verifikator belum bisa menandai aduan duplikat; kepala dinas belum bisa memindahkan aduan antar dinas.
- Impor CSV anggaran belum menolak `budget_realized > budget_allocated` dan tidak menyertakan kolom `location_lat`/`location_lng` sesuai PRD.

Hasil runtime Playwright memperkuat sebagian celah di atas dan menemukan masalah runtime tambahan: *mismatch judul* saat koreksi klasifikasi aduan, *duplikat label status* di tabel layanan, *kolom `description` tidak ditemukan* di `emergency_alerts`, serta *ketidakcocokan teks/selector* pada halaman pengguna dan role-gate.

**Kesimpulan tingkat atas:** Dashboard mengimplementasikan sebagian besar modul PRD, tetapi memiliki deviasi keamanan/desain signifikan dan beberapa aksi admin penting yang masih belum tersedia. Sebelum produksi, celah kritis terkait autentikasi/token dan validasi anggaran harus diselesaikan.

---

## Matriks Cakupan dan Hasil Pengujian

| Berkas Spesifikasi | Jumlah Tes | Lulus | Gagal | Dilewati | Modul yang Tercakup |
|---|---:|---:|---:|---:|---|
| `e2e/web-smoke.spec.ts` | 2 | 2 | 0 | 0 | Smoke test (halaman login dan root) |
| `e2e/web-auth.spec.ts` | 5 | 5 | 0 | 0 | Autentikasi OTP, peran, dan pengalihan pasca-masuk |
| `e2e/web-aduan.spec.ts` | 6 | 1 | 1 | 4 | Aduan (verifikasi, dinas, duplikat, pindah dinas) |
| `e2e/web-aspirasi-anggaran.spec.ts` | 6 | 6 | 0 | 0 | Aspirasi dan Anggaran |
| `e2e/web-ops.spec.ts` | 10 | 2 | 4 | 4 | Layanan, Darurat, Pengumuman, Pengguna, Warga, Role-gate |
| **Total** | **28** | **16** | **5** | **7** | |

Sumber: `docs/web-audit-results.json` dan `docs/web-audit-results.log`.

---

## Temuan Audit per Modul

| Modul | Status | Implementasi yang Teruji | Celah / Deviasi | Bukti |
|---|---|---|---|---|
| **M0 — Autentikasi & Sesi** | Deviasi | Alur OTP email (permintaan & verifikasi), pengalihan peran (`emergency_operator` → `/darurat`, lainnya → `/`), muat profil dari tabel `profiles`. | 1. Prefill `devCode` di input OTP (`apps/web/app/login/page.tsx:121-123,134-136`).<br>2. Access & refresh token disimpan di `localStorage` (`apps/web/app/_lib/session.ts:21-39`).<br>3. `auth-signout` dipanggil tanpa header `Authorization` (`apps/web/app/_lib/api.ts:58-63`).<br>4. `StaffProfile.email` dibaca dari klaim `email` yang tidak ada di JWT PRD (`apps/web/app/_lib/auth.tsx:36-39,108-117`). | Kode: `apps/web/app/login/page.tsx`, `apps/web/app/_lib/session.ts`, `apps/web/app/_lib/api.ts`, `apps/web/app/_lib/auth.tsx`. Tes: `e2e/web-auth.spec.ts` (5/5 lulus, namun tidak mengasertasi penyimpanan token aman). |
| **Ringkasan Dashboard (`/`)** | Tersedia | KPI, filter status, beban kategori, kepatuhan SLA, panel keputusan, scope peran. | Tidak ada deviasi signifikan. | Kode: `apps/web/app/page.tsx:47-740`. Tes: `e2e/web-auth.spec.ts` (dashboard terlihat setelah login). |
| **M1 — Aduan (`/aduan`)** | Sebagian | Verifikator dapat mengoreksi klasifikasi (dinas/kategori/urgensi) dan menolak dengan alasan. Staf dinas dapat menindaklanjuti dengan catatan dan foto progres. RLS dinas terpasang. | 1. **Missing:** Verifikator belum bisa menandai aduan duplikat (`apps/web/app/aduan/_verifikasiTab.tsx`).<br>2. **Missing:** Kepala dinas belum bisa memindahkan aduan antar dinas (`apps/web/app/aduan/_dinasTab.tsx`).<br>3. **Runtime:** Tes penolakan aduan gagal karena ada dua tombol "Tolak" yang cocok (dua kartu aduan dengan judul sama tampak bersamaan) (`e2e/web-aduan.spec.ts:147`).<br>4. Tes perubahan status dinas dan tes gap duplikat/pindah dinas tidak berjalan karena serial block berhenti setelah kegagalan penolakan. | Kode: `apps/web/app/aduan/_verifikasiTab.tsx:190-446`, `apps/web/app/aduan/_dinasTab.tsx:82-175`. Tes: `e2e/web-aduan.spec.ts` (1 lulus, 1 gagal, 4 dilewati). |
| **M2 — Aspirasi (`/aspirasi`)** | Tersedia | CRUD periode voting, tinjauan aspirasi, alur status (`voting → musrenbang → approved → budgeted`), penautan item anggaran. | Tidak ada deviasi signifikan. | Kode: `apps/web/app/aspirasi/page.tsx:86-487`. Tes: `e2e/web-aspirasi-anggaran.spec.ts` (3/3 lulus untuk aspirasi). |
| **M3 — Anggaran (`/anggaran`)** | Sebagian | Impor CSV, tabel status indeks pencarian semantik, pengindeksan ulang. | 1. **Deviasi:** Format CSV tidak menyertakan `location_lat` dan `location_lng` (`packages/shared/src/budgetCsv.ts:27-37`), padahal PRD 9.4 menyebutkannya.<br>2. **Missing:** Parser tidak menolak baris `budget_realized > budget_allocated` (`packages/shared/src/budgetCsv.ts:112-126`). | Kode: `packages/shared/src/budgetCsv.ts:27-37,112-126`, `apps/web/app/anggaran/page.tsx:254-366`. Tes: `e2e/web-aspirasi-anggaran.spec.ts` (3/3 lulus untuk anggaran, termasuk tes yang mengonfirmasi over-budget diterima dengan anotasi `gap`). |
| **M4 — Layanan (`/layanan`, `/verify/[code]`)** | Tersedia dengan deviasi selector | Antrean permohonan, perubahan status, alasan penolakan, pratinjau dokumen via signed URL, pembuatan PDF, verifikasi publik QR. | **Runtime:** Tes perubahan status gagal karena `getByText(/verifying|Verifikasi/i)` hanya menemukan teks tersembunyi pada `<option value="verifying">Diverifikasi</option>`, bukan label status yang terlihat (`e2e/web-ops.spec.ts:62`, "Received: hidden"). | Kode: `apps/web/app/layanan/page.tsx:125-300`. Tes: `e2e/web-ops.spec.ts` — Layanan (1 lulus, 1 gagal). |
| **M5 — Darurat (`/darurat`)** | Sebagian | Antrean SOS realtime, tombol tanggapi/selesai/tandai palsu, audio via signed URL, role-gate operator/admin. | **Runtime:** Tes gagal saat setup data karena kolom `description` tidak ada di tabel `emergency_alerts` (`PGRST204`, `e2e/web-ops.spec.ts:91`). Kode halaman memakai `note`, bukan `description`. | Kode: `apps/web/app/darurat/page.tsx:70-410`. Tes: `e2e/web-ops.spec.ts` — Darurat (0 lulus, 1 gagal). |
| **M6 — Pengumuman (`/pengumuman`) & Warga (`/warga`)** | Tersedia | CRUD pengumuman, sematkan, refresh leaderboard, direktori warga per kelurahan. | UI pengumuman belum sepenuhnya terverifikasi oleh selector runtime; tes bersifat kondisional (`e2e/web-ops.spec.ts:136`). | Kode: `apps/web/app/pengumuman/page.tsx:1-623`, `apps/web/app/warga/page.tsx:1-216`. Tes: `e2e/web-ops.spec.ts` — Pengumuman & Warga (2 lulus). |
| **Pengguna (`/pengguna`)** | Tersedia dengan deviasi selector | Admin dapat mengubah peran, menugaskan dinas, menonaktifkan/mengaktifkan akun. | **Runtime:** `listStaffUsers` gagal memuat daftar pengguna karena ambiguitas relasi embed (`PGRST201`), sehingga tabel kosong dan tes timeout mencari tombol "Ubah Peran" (`e2e/web-ops.spec.ts:136`). Tes role-gate juga gagal karena teks "Hanya untuk petugas" tidak ditemukan (`e2e/web-ops.spec.ts:165`). | Kode: `apps/web/app/pengguna/page.tsx:1-303`. Tes: `e2e/web-ops.spec.ts` — Pengguna & Role-gate (1 lulus, 2 gagal, 1 dilewati). |
| **Design System & Guardrails** | Deviasi | Semua warna berasal dari `@repo/shared` (tidak ada hex literal di `apps/web/` kecuali reset CSS); bahasa Indonesia konsisten; empty state memenuhi pola. | 1. Mode gelap tidak diimplementasikan: `const THEME = colors.light` di seluruh halaman (`apps/web/app/page.tsx:13`, `apps/web/app/login/page.tsx:10`, `apps/web/app/aduan/_verifikasiTab.tsx:14`, dsb.).<br>2. Target sentuh dan teks isi sering di bawah minimal PRD: `minHeight: 32–36 px` dan font 12–14 px (`apps/web/app/aduan/_verifikasiTab.tsx:424`, `apps/web/app/aspirasi/page.tsx:488`, `apps/web/app/_lib/ui.tsx:355`). | Kode: `packages/shared/src/theme.ts`, `apps/web/app/**/page.tsx`, `apps/web/app/_lib/ui.tsx`. |

---

## Celah yang Terkonfirmasi dengan Bukti Kode dan Tes

1. **OTP `devCode` muncul di UI login**
   - **Kode:** `apps/web/app/login/page.tsx:121-123,134-136` memanggil `setCode(result.devCode ?? '')` setelah `requestOtp`, sehingga kode langsung terisi di input OTP.
   - **Dampak:** Melanggar kriteria penerimaan M0 #18 (dev-mode tidak boleh terlihat di UI produksi).

2. **Token staf tersimpan di `localStorage`**
   - **Kode:** `apps/web/app/_lib/session.ts:21-39` menyimpan access token, refresh token, dan expiry di `localStorage`.
   - **Dampak:** Rentan XSS; PRD mensyaratkan penyimpanan aman (mobile: SecureStore; web seharusnya `httpOnly` cookie atau minimal memory-only access token).

3. **`auth-signout` tidak mengirim header `Authorization`**
   - **Kode:** `apps/web/app/_lib/api.ts:58-63` memanggil `auth-signout` hanya dengan `{refreshToken}` di body, tanpa `Authorization: Bearer <access token>`.
   - **Dampak:** Edge Function kemungkinan tidak dapat mencabut sesi pemanggil (PRD 7.6 langkah 1).

4. **Email staf hilang setelah muat ulang**
   - **Kode:** `apps/web/app/_lib/auth.tsx:36-39` membaca klaim `email` dari JWT, sedangkan PRD S12 hanya mensyaratkan `sub`, `role`, `aud`, `iat`, `exp`.
   - **Dampak:** `StaffProfile.email` kosong setelah refresh halaman.

5. **Mode gelap tidak diimplementasikan**
   - **Kode:** Seluruh komponen halaman dan `_lib/*.tsx` memakai `const THEME = colors.light` (contoh: `apps/web/app/page.tsx:13`, `apps/web/app/login/page.tsx:10`, `apps/web/app/aduan/_verifikasiTab.tsx:14`).
   - **Tes:** Tidak ada asersi tema gelap.

6. **Target sentuh dan teks isi di bawah minimal**
   - **Kode:** `apps/web/app/aduan/_verifikasiTab.tsx:424` (`minHeight: 36`), `apps/web/app/aspirasi/page.tsx:488` (`smallButtonStyle` `minHeight: 36`), `apps/web/app/_lib/ui.tsx:355` (`retryButtonStyle` `minHeight: 36`), serta font 12–14 px banyak digunakan.
   - **Dampak:** Melanggar PRD T3 (target sentuh ≥44×44 px) dan 5.3 (body text ≥16 px).

7. **Verifikator belum bisa menandai aduan duplikat**
   - **Kode:** `apps/web/app/aduan/_verifikasiTab.tsx` tidak memiliki aksi `duplicate_of` maupun `complaint_upvotes` duplikat.
   - **Tes:** `e2e/web-aduan.spec.ts:165` (anotasi `gap`) memverifikasi tidak ada tombol "Tandai duplikat".

8. **Kepala dinas tidak bisa memindahkan aduan antar dinas**
   - **Kode:** `apps/web/app/aduan/_dinasTab.tsx` hanya menyediakan perubahan status `verified → in_progress → resolved` dan unggah foto progres; tidak ada aksi pindah dinas.
   - **Tes:** `e2e/web-aduan.spec.ts:132` (anotasi `gap`) memverifikasi tidak ada tombol "Pindah/Pindahkan dinas".

9. **Impor CSV anggaran tidak menolak `budget_realized > budget_allocated`**
   - **Kode:** `packages/shared/src/budgetCsv.ts:112-126` hanya memeriksa nilai negatif dan rentang `progress_percent`.
   - **Tes:** `e2e/web-aspirasi-anggaran.spec.ts:102` mengimpor baris dengan `budget_realized=200000000` dan `budget_allocated=100000000` serta mengonfirmasi baris diterima (anotasi `gap`).

10. **Format CSV anggaran tidak sesuai spesifikasi PRD**
    - **Kode:** `packages/shared/src/budgetCsv.ts:27-37` `BUDGET_CSV_COLUMNS` tidak menyertakan `location_lat` dan `location_lng`.
    - **Dampak:** CSV yang disusun sesuai PRD 9.4 akan gagal atau kolom koordinat akan diabaikan.

11. **Tes penolakan aduan gagal karena dua tombol "Tolak"**
   - **Tes:** `e2e/web-aduan.spec.ts:147` gagal dengan "strict mode violation: getByRole('button', { name: 'Tolak' }) resolved to 2 elements".
   - **Catatan:** Dua kartu aduan dengan judul "Aduan Uji Aduan" tampak bersamaan di antrean verifier karena data dari tes klasifikasi sebelumnya belum terpisah.

12. **Tabel Layanan: status `verifying` tidak terlihat sebagai teks**
    - **Tes:** `e2e/web-ops.spec.ts:62` gagal karena `getByText(/verifying|Verifikasi/i)` hanya menemukan `<option value="verifying">Diverifikasi</option>` yang tersembunyi ("Received: hidden").
    - **Catatan:** Label status tampaknya berubah menjadi "Diverifikasi" di UI, sementara tes mencari "verifying" / "Verifikasi"; perlu selaraskan teks atau selector.

13. **`emergency_alerts` tidak memiliki kolom `description`**
    - **Tes:** `e2e/web-ops.spec.ts:91` gagal dengan `PGRST204: description column missing on emergency_alerts` saat setup data.
    - **Kode:** `apps/web/app/darurat/page.tsx` memakai kolom `note`, bukan `description`. Perlu selaraskan schema atau test helper.

14. **Daftar pengguna tidak termuat karena ambiguitas relasi embed**
    - **Tes:** `e2e/web-ops.spec.ts:136` timeout karena `listStaffUsers` mengembalikan `PGRST201` (lebih dari satu relasi ditemukan untuk `profiles` dan `id`), sehingga tabel pengguna kosong dan tombol "Ubah Peran" tidak ditemukan.
    - **`e2e/web-ops.spec.ts:165` tidak menemukan teks "Hanya untuk petugas".**

---

## Rekomendasi Berprioritas

### Kritis
1. **Perbaiki penyimpanan token autentikasi** — pindahkan access token ke memory (atau `httpOnly` cookie) dan refresh token ke penyimpanan yang lebih aman; jangan simpan keduanya di `localStorage` (`apps/web/app/_lib/session.ts`).
2. **Tambahkan header `Authorization` pada `auth-signout`** (`apps/web/app/_lib/api.ts:58-63`) agar server dapat mencabut sesi yang sah.
3. **Hapus prefilling `devCode` di UI login** (`apps/web/app/login/page.tsx:121-136`); `devCode` hanya boleh digunakan di backend/test, bukan di input pengguna.
4. **Ambil email staf dari tabel `profiles` atau dari respons `verifyOtp` saja**, jangan bergantung pada klaim `email` JWT yang tidak ada di spesifikasi (`apps/web/app/_lib/auth.tsx:36-39,108-117`).
5. **Perbaiki validasi impor CSV anggaran** — tolak baris dengan `budget_realized > budget_allocated` dan laporkan nomor baris (`packages/shared/src/budgetCsv.ts:112-126`).
6. **Selaraskan schema `emergency_alerts`** — gunakan `note` secara konsisten, atau tambahkan kolom `description`, dan sesuaikan test helper (`e2e/web-ops.spec.ts:91`).
7. **Perbaiki RPC/status aduan** — ubah `event_type` yang disisipkan oleh `dinas_update_complaint_status` dari `"in_progress"` menjadi `"progress"` agar sesuai constraint (`e2e/web-aduan.spec.ts:132`).

### Tinggi
8. **Tambahkan aksi "Tandai duplikat"** di tab Verifikasi (`apps/web/app/aduan/_verifikasiTab.tsx`) untuk mengisi `complaints.duplicate_of`.
9. **Tambahkan aksi "Pindah dinas"** di tab Dinas untuk peran `dinas_head` (`apps/web/app/aduan/_dinasTab.tsx`).
10. **Tambahkan kolom `location_lat` dan `location_lng` ke `BUDGET_CSV_COLUMNS`** (`packages/shared/src/budgetCsv.ts:27-37`) agar sesuai PRD 9.4.
11. **Implementasikan mode gelap** — ganti `const THEME = colors.light` dengan pembacaan preferensi sistem/perangkat, dan pastikan seluruh komponen memakai tema aktif.
12. **Perbaiki ukuran target sentuh dan teks isi** — naikkan `minHeight` tombol/minimal touch target menjadi ≥44 px dan pastikan body text minimal 16 px sesuai PRD.

### Sedang
13. **Stabilkan selector status di tabel Layanan** — berikan atribut `data-testid` atau label unik untuk status setiap baris agar tidak terjadi duplikat match (`e2e/web-ops.spec.ts:62`).
14. **Selaraskan selector E2E Pengguna** — perbarui spesifikasi agar memicu perubahan peran melalui `<select>` dan menunggu modal "Ubah peran pengguna", atau tambahkan tombol eksplisit jika UI ingin diubah.
15. **Tambahkan asersi keamanan di E2E** — verifikasi bahwa token tidak tertinggal di `localStorage` setelah logout dan bahwa `auth-signout` dipanggil dengan header yang benar.
16. **Perjelas pesan role-gate** — tampilkan teks yang konsisten (misalnya "Akses ditolak" / "Hanya untuk petugas") sehingga tes role-gate stabil.

---

*Laporan ini ditulis berdasarkan `docs/audit-web-prd-plan.md`, `docs/web-audit-results.json`, `docs/web-audit-results.log`, dan spesifikasi Playwright di `e2e/web-*.spec.ts`.*
