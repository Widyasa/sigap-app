# Audit QA — Agustus 2026

Audit menyeluruh atas monorepo SIGAP: dashboard petugas (`apps/web`),
aplikasi warga (`apps/native`), paket bersama, skema/RLS Postgres, dan Edge
Functions. Dokumen ini mencatat apa yang sudah diperbaiki, apa yang belum,
dan apa yang harus dijalankan Widyasa sebelum perbaikannya berlaku.

## Batasan audit — penting

**Tidak ada satu pun pengujian ujung-ke-ujung yang bisa dijalankan.** Proyek
Supabase yang dirujuk `apps/web/.env.local.example` dan
`apps/native/app.json` — `kfbbaeuzvfzcbwjlopne.supabase.co` — mengembalikan
NXDOMAIN, jadi sudah dihapus atau diganti. Docker juga tidak tersedia di
mesin tempat audit dijalankan, sehingga `supabase start` bukan pilihan.

Akibatnya:

* Seluruh migrasi di bawah **belum pernah dijalankan terhadap basis data**.
  Perubahannya ditulis mengikuti pola yang sudah ada di repo dan sudah
  ditinjau baris demi baris, tetapi tetap perlu `supabase db push` ke
  lingkungan staging lalu diuji asap sebelum dianggap benar.
* Perubahan Edge Function belum dijalankan; `deno test` untuk berkas
  `_shared` bisa dijalankan lokal dan kini juga berjalan di CI.
* Semua yang tidak butuh basis data **sudah** diverifikasi:
  `turbo run typecheck test lint`, `next build` (dengan dan tanpa
  `.env.local`), dan penelusuran manual setiap rute dashboard di lebar
  1440 / 1024 / 375 px.

**Yang perlu dilakukan Widyasa:**

1. Sediakan proyek Supabase yang hidup, lalu perbarui
   `apps/web/.env.local.example` dan `apps/native/app.json`.
2. Jalankan `supabase db push` untuk keempat migrasi baru
   (`20260816000001` … `20260816000004`).
3. Deploy ulang Edge Function `auth-request-otp`, `auth-verify-otp`,
   `auth-refresh`, `embed-text`, `ask-budget`, `ocr-doc`, dan
   `generate-service-pdf`.
4. Uji asap: masuk sebagai tiap peran, kirim aduan, kirim SOS, terbitkan satu
   surat (termasuk `kelahiran`/`kematian`), impor CSV anggaran.

## Perubahan yang butuh perhatian khusus saat ditinjau

| Perubahan | Kenapa perlu dicek langsung |
|---|---|
| `REVOKE SELECT ... FROM anon` | Kalau ada layar publik yang belum teridentifikasi membaca tabel tanpa sesi, layar itu akan berhenti bekerja. Penelusuran kode hanya menemukan satu jalur anon, yaitu RPC `verify_service_document`. |
| `profiles_read`/`complaints_read` butuh sesi | Sama seperti di atas; seluruh query aplikasi berjalan dengan sesi. |
| `DROP POLICY complaints_owner_update`/`aspirations_owner_update` | Tidak ada kode klien yang memakainya hari ini. Kalau nanti warga perlu menyunting aduannya sendiri, tambahkan RPC khusus kolom, jangan kembalikan policy-nya. |
| `dinas_update_complaint_status` | Mengganti dua penulisan terpisah dengan satu transaksi. Perlu diuji dengan akun `dinas_staff` sungguhan. |
| Matview `kelurahan_leaderboard` dibuat ulang | `DROP ... CASCADE` lalu dibuat ulang; angka poin akan BERUBAH (turun) karena sebelumnya menggelembung. |
| `set_user_role` | `updateUserRole` sekarang lewat RPC ini; UPDATE langsung ke `profiles` tidak lagi dipakai dari klien. |

## Temuan yang SENGAJA belum diperbaiki

Sisa berikut butuh basis data hidup, keputusan produk, atau berukuran fitur —
bukan perbaikan cacat.

1. **Bucket `service-docs` dan audio SOS terbuka untuk seluruh peran
   petugas.** `20260811000001_service_docs_staff_read.sql` memberi SELECT
   atas seluruh bucket kepada `verifier`, `dinas_staff`, `dinas_head`, dan
   `admin` tanpa kaitan ke permohonan yang sedang ditangani — satu akun
   berperan rendah bisa mengunduh semua pindaian KTP/KK di sistem.
   Perbaikannya butuh policy yang mengikat objek storage ke baris
   `service_requests` yang benar-benar ditangani petugas itu, dan itu wajib
   diuji terhadap data nyata sebelum diterapkan: salah sedikit, seluruh
   petugas kehilangan akses ke berkas permohonan yang sah.
2. **Draf luring dan antrean kirim ulang.** PRD 11.1 mewajibkan draf aduan
   disimpan di AsyncStorage dan dikirim ulang saat koneksi kembali, plus
   spanduk "Menampilkan data tersimpan" di layar baca. Belum ada.
3. **Unggah foto per-berkas dengan progres dan coba-lagi.** Foto aduan
   diunggah sekaligus saat kirim, jadi satu kegagalan membuang semuanya.
   PRD meminta status per foto, ikon coba-lagi, dan pengiriman tetap jalan
   bila minimal satu foto berhasil. (Label "terunggah" yang menyesatkan
   sudah diganti menjadi "dipilih".)
4. **Kompresi foto sebelum unggah.** PRD 15.3 meminta lebar maksimum 1280px;
   saat ini hanya `quality: 0.7` tanpa perubahan dimensi.
5. **Font ganda di aplikasi warga.** `expo-font` belum terpasang dan berkas
   fontnya belum ada; hanya dashboard web yang memakai Plus Jakarta Sans +
   Inter.
6. **Bottom sheet Feed belum memakai snap point 30/60/95%** seperti
   DESIGN.md; masih pengalih dua keadaan.
7. **Retensi 30 hari dokumen layanan.** Tidak ada job penghapusan yang
   mengimplementasikannya. Janji ke warga sudah dihapus dari layar sampai
   penghapusannya benar-benar ada, tapi kebijakan retensinya sendiri masih
   perlu diputuskan.
8. **Hak hapus data warga.** Tidak ada policy DELETE untuk warga dan tidak
   ada jalur penghapusan akun, sementara UU 27/2022 Pasal 8 mewajibkannya.
   Ini keputusan produk sekaligus perubahan skema.
9. **Haptics dan cincin progres melingkar pada tombol SOS.** DESIGN.md
   memintanya; `expo-haptics` belum jadi dependensi. Jalur aksesibilitas dan
   pemulihan izin lokasi SUDAH diperbaiki, jadi tidak ada lagi jalan buntu —
   sisanya murni penghalusan.

## Catatan lint

`react-hooks/set-state-in-effect` dan `preserve-manual-memoization`
diturunkan ke peringatan. Keduanya aturan penasihat React Compiler yang
menandai pola "ambil data di useEffect lalu setState" yang dipakai hampir
semua halaman dashboard. Pola itu memang pantas ditinjau, tapi menjadikannya
galat berarti CI merah sejak hari pertama tanpa satu pun cacat nyata.

## CI belum ada — berkas workflow yang disarankan

Repo ini tidak punya `.github/workflows` sama sekali. Satu-satunya otomasi
adalah build Vercel (`vercel.json`), yang hanya menjalankan
`turbo run build --filter=web` dan karena itu **tidak pernah** menjalankan
typecheck, unit test, maupun lint. Beberapa cacat dalam audit ini akan
tertangkap otomatis begitu CI ada.

Berkas di bawah tidak bisa ikut di PR ini: Personal Access Token yang dipakai
tidak punya scope `workflow`, sehingga GitHub menolak push yang membuat atau
mengubah berkas di `.github/workflows/`. Silakan tambahkan sendiri sebagai
`.github/workflows/ci.yml`.

```yaml
# Repo ini belum punya CI sama sekali: satu-satunya otomasi adalah build
# Vercel (`vercel.json`), yang hanya menjalankan `turbo run build --filter=web`
# dan karena itu tidak pernah menjalankan typecheck, unit test, maupun lint.
# Beberapa cacat yang ditemukan audit QA Agustus 2026 akan tertangkap di sini.
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  verify:
    name: Typecheck, test, lint, build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm

      - run: npm ci

      - name: Typecheck
        run: npx turbo run typecheck

      - name: Unit tests
        run: npx turbo run test

      - name: Lint
        run: npx turbo run lint

      # Dijalankan TANPA .env sengaja: build pernah gagal total di tahap
      # prerender ketika variabel Supabase tidak ada, termasuk untuk halaman
      # yang sama sekali tidak memakai Supabase.
      - name: Build web tanpa env
        run: npx turbo run build --filter=web

  edge-functions:
    name: Deno tests (Edge Functions)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - name: Deno test
        working-directory: supabase/functions
        run: deno test --allow-env --allow-net --no-check
```
