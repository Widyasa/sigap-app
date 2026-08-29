# SIGAP — PRD & AI Build Specification

**Sistem Informasi Gerakan Aspirasi & Pelayanan**

Product Requirements Document lengkap sekaligus build specification yang dapat dibaca dan dieksekusi langsung oleh AI coding agent. Mencakup enam modul, arsitektur monorepo, skema database beserta Row Level Security, kontrak Edge Function, design system, dan spesifikasi layar tingkat komponen untuk aplikasi React Native (Expo SDK 51 + Expo Router).

| | |
|---|---|
| **Versi** | 2.0 |
| **Tanggal** | 10 Agustus 2026 |
| **Platform** | React Native · Expo SDK 51 · Expo Router v3 |
| **Autentikasi** | Custom OTP email · Resend · JWT ditandatangani Supabase |
| **Backend** | Supabase (PostgreSQL 15 + pgvector) — **database, storage, realtime saja** |
| **AI** | Groq Cloud · Google AI (vision) |
| **Peta** | react-native-maps (Google Mobile SDK / Apple Maps) · MapLibre GL JS di dashboard |
| **Status** | Approved — siap dieksekusi |
| **Pembaca** | AI coding agent & tim engineering |

---

## Perubahan dari Versi 1.0

Versi ini mengubah dua keputusan arsitektur. Sisanya identik dengan v1.0.

| Area | v1.0 | v2.0 | Bagian terdampak |
|---|---|---|---|
| Autentikasi | Supabase Auth, OTP SMS ke nomor HP | OTP enam digit ke **email**, dikirim lewat **Resend**, sesi memakai JWT yang kita tandatangani sendiri | 2.2, 4.1, 4.3, 4.4, 6.3, 6.5, 7.6, 8.2, 9.1, 12, 13, 15.3 |
| Peran Supabase | Auth + Database + Storage + Realtime | **Database + Storage + Realtime saja.** `auth.users` tidak dipakai. | 4.1, 6.3, 6.5, 6.6 |
| Pengiriman email | — (SMS lewat Supabase) | Resend, dibungkus Edge Function `_shared/resend.ts` | 4.4, 7.6, 15.3 |
| Peta | react-native-maps + kuota Mapbox disebut di 15.3 | react-native-maps di mobile (biaya nol), MapLibre GL JS + tile gratis di dashboard. **Mapbox dihapus seluruhnya.** | 4.3, 9.2, 15.3 |
| Reverse geocode | Tidak ditentukan | `expo-location.reverseGeocodeAsync` — geocoder bawaan OS, tanpa API key | 5.4, 9.2 |

**Yang TIDAK berubah:** seluruh model data selain identitas, semua policy RLS (`auth.uid()` tetap berfungsi — lihat 6.6), design system, kontrak Edge Function AI, spesifikasi M1 sampai M6, UX writing, dan Definition of Done.

---

> **Errata repo ini**: Repo aktual memakai `npm` (bukan `pnpm 9`) dan nama direktori starter `apps/native` serta `apps/web` (bukan `apps/mobile`/`apps/admin`). Keputusan tim adalah tidak melakukan migrasi tooling/penamaan; implementasi memakai direktori dan package scope yang ada. Lihat `docs/adr/0001-npm-and-existing-directory-names.md`. Saat dokumen ini menyebut `apps/mobile`, maksudnya `apps/native`; saat menyebut `apps/admin`, maksudnya `apps/web`.

---

## Daftar Isi

- [0 · Cara Memakai Dokumen Ini](#0--cara-memakai-dokumen-ini)
- [1 · Konteks Produk](#1--konteks-produk)
- [2 · Aturan Wajib (Guardrails)](#2--aturan-wajib-guardrails)
- [3 · Persona & Peran](#3--persona--peran)
- [4 · Arsitektur](#4--arsitektur)
- [5 · Design System](#5--design-system)
- [6 · Model Data](#6--model-data)
- [7 · Lapisan AI, Auth & Edge Function](#7--lapisan-ai-auth--edge-function)
- [8 · Navigasi Aplikasi](#8--navigasi-aplikasi)
- [9 · Spesifikasi Modul](#9--spesifikasi-modul)
- [10 · UX Writing](#10--ux-writing)
- [11 · Error, Offline & Empty State](#11--error-offline--empty-state)
- [12 · Testing & Definition of Done](#12--testing--definition-of-done)
- [13 · Rencana Eksekusi per Sprint](#13--rencana-eksekusi-per-sprint)
- [14 · Prompt Siap Pakai](#14--prompt-siap-pakai)
- [15 · Batasan & Non-Goals](#15--batasan--non-goals)
- [16 · Glosarium](#16--glosarium)

---

# 0 · Cara Memakai Dokumen Ini

> ### UNTUK AI CODING AGENT — BACA INI LEBIH DULU
>
> Dokumen ini adalah satu-satunya sumber kebenaran untuk membangun SIGAP. Perlakukan seluruh isinya sebagai instruksi terikat, bukan saran. Jika Anda menemukan kebutuhan yang tidak tercantum di sini, jangan berimprovisasi diam-diam — tuliskan asumsi Anda secara eksplisit di komentar kode dengan awalan `// ASUMSI:` lalu lanjutkan dengan pilihan paling konservatif.

## 0.1 Kontrak kerja AI agent

Saat mengerjakan dokumen ini, Anda terikat pada tujuh aturan berikut:

| Aturan | Isi |
|---|---|
| **R1 · Test dulu** | Untuk setiap unit logika (validasi, parsing, perhitungan SLA, perhitungan poin, pembuatan & verifikasi OTP, penandatanganan JWT), tulis test yang gagal terlebih dahulu, jalankan untuk memastikan gagal, baru tulis implementasinya. Tidak ada logika bisnis tanpa test. |
| **R2 · Satu task satu commit** | Setiap task pada Bagian 13 berakhir dengan satu commit Conventional Commits. Jangan menggabungkan dua task dalam satu commit. |
| **R3 · Verifikasi nyata** | Setiap task punya perintah verifikasi. Jalankan perintahnya dan bandingkan dengan hasil yang diharapkan. Jangan menyatakan selesai berdasarkan pembacaan kode saja. |
| **R4 · Tanpa hex literal** | Semua warna, ukuran font, dan spacing wajib berasal dari `@sigap/shared`. Jika Anda menulis `#` diikuti enam digit heksadesimal di dalam folder `apps/`, Anda melanggar dokumen ini. |
| **R5 · Data tidak boleh hilang** | Tidak ada satu pun alur di mana input warga hilang karena kegagalan AI, jaringan, atau layanan pihak ketiga. Simpan dulu, perkaya kemudian. |
| **R6 · RLS adalah otorisasi** | Otorisasi dijalankan di database melalui Row Level Security. Pengecekan peran di sisi React Native hanya untuk menyembunyikan tombol, bukan untuk keamanan. Jangan pernah mengandalkannya. |
| **R7 · Jangan menambah dependensi** | Gunakan hanya paket yang tercantum di Bagian 4.3. Jika Anda merasa butuh paket lain, tuliskan alasannya sebagai komentar `// ASUMSI:` dan pilih solusi tanpa paket baru bila memungkinkan. |

## 0.2 Urutan baca wajib

Jangan mulai menulis kode sebelum membaca berurutan: **Bagian 2** (aturan) → **Bagian 4** (arsitektur) → **Bagian 5** (design system) → **Bagian 6** (model data) → barulah bagian modul yang sedang dikerjakan.

Bagian 6 adalah fondasi; hampir setiap keputusan di bagian modul mengacu ke nama tabel dan kolom di sana. Bila Anda mengerjakan apa pun yang menyentuh sesi pengguna, **Bagian 7.6 wajib dibaca sebelum Bagian 9.1** — sistem autentikasi SIGAP dibangun sendiri, bukan diwarisi dari Supabase Auth.

## 0.3 Definisi selesai (Definition of Done)

Sebuah fitur dinyatakan selesai hanya bila seluruh butir berikut terpenuhi:

1. `pnpm typecheck` lulus tanpa error di seluruh workspace.
2. `pnpm test` lulus, dan test baru benar-benar menguji perilaku (bukan sekadar `expect(true).toBe(true)`).
3. Alur happy path berjalan di perangkat/emulator nyata, bukan hanya di test.
4. Alur gagal ditangani: AI mati, jaringan putus, email tidak sampai, izin ditolak, data kosong.
5. Tidak ada hex literal, tidak ada string bahasa Inggris di antarmuka.
6. Body text minimal 16px, target sentuh minimal 44×44 px.
7. RLS diuji: pengguna dengan peran salah benar-benar ditolak database.

---

# 1 · Konteks Produk

## 1.1 Masalah

Aplikasi pengaduan pemerintah daerah di Indonesia umumnya gagal pada empat titik yang sama:

| Kegagalan | Akibat | Penanganan di SIGAP |
|---|---|---|
| Aduan masuk lalu senyap | Warga berhenti melapor setelah pengalaman pertama | Timeline visual, foto progres petugas, countdown SLA, nama penanggung jawab |
| Disposisi manual antar dinas | Aduan menganggur berhari-hari sebelum sampai ke dinas yang benar | Klasifikasi AI otomatis ke dinas + tingkat urgensi dalam hitungan detik |
| Aduan duplikat menumpuk | Satu lubang jalan menghasilkan 40 tiket berbeda | Deteksi duplikat semantik + geografis, warga diarahkan mendukung laporan yang ada |
| Partisipasi berhenti di keluhan | Tidak ada bukti bahwa suara warga mempengaruhi anggaran | Loop tertutup: aspirasi → Musrenbang → mata anggaran APBD → foto realisasi |

## 1.2 Solusi & enam pilar

| Kode | Modul | Fungsi inti | Prioritas |
|---|---|---|---|
| **M0** | AUTH | Masuk dengan OTP email, profil warga, pemilihan kelurahan | Wajib |
| **M1** | LAPOR | Aduan berfoto, klasifikasi AI ke dinas, deteksi duplikat, timeline, SLA | Wajib |
| **M2** | ASPIRASI | Usulan pembangunan, voting per kelurahan, ranking Musrenbang | Tinggi |
| **M3** | ANGGARAN | Transparansi APBD, drill down per dinas, tanya-jawab AI berbasis RAG | Tinggi |
| **M4** | LAYANAN | Pengajuan surat administrasi, OCR KTP/KK, PDF + QR verifikasi | Normal |
| **M5** | DARURAT | Tombol SOS tekan-tahan, GPS + audio 10 detik, antrean prioritas | Wajib |
| **M6** | INFO & KOMUNITAS | Pengumuman, leaderboard kelurahan, poin & lencana | Normal |

## 1.3 Pembeda utama

1. **AI fungsional, bukan hiasan.** AI mengubah alur kerja petugas: tanpa AI, disposisi manual; dengan AI, aduan sampai ke dinas yang tepat dengan urgensi terukur sebelum petugas membukanya. AI juga mendeteksi duplikat dan menjawab pertanyaan anggaran.
2. **Loop tertutup aspirasi → APBD.** Warga dapat menelusuri usulannya sampai menjadi mata anggaran nyata beserta persen realisasinya. Ini menjawab pertanyaan yang tidak pernah dijawab aplikasi Pemda lain: "apakah suara saya berpengaruh?"
3. **Gamifikasi berbasis kelurahan.** Leaderboard antar-kelurahan mengubah partisipasi individual menjadi kebanggaan komunitas. Poin disimpan sebagai ledger agar dapat diaudit dan dibatalkan bila laporan terbukti palsu.

## 1.4 Metrik keberhasilan

| Metrik | Target | Cara ukur |
|---|---|---|
| Waktu dari kirim aduan sampai terklasifikasi | < 5 detik (p95) | Selisih `created_at` dan event `ai_classified` di `complaint_timeline` |
| Akurasi klasifikasi dinas | ≥ 85% | Persentase klasifikasi AI yang tidak dikoreksi verifier |
| Aduan duplikat yang tercegah | ≥ 30% | Jumlah warga memilih "dukung laporan yang ada" dibagi total deteksi duplikat |
| Waktu penyelesaian dalam SLA | ≥ 70% | `resolved_at <= sla_due_at` |
| Aduan tidak hilang saat AI mati | 100% | Semua baris berstatus `pending_classification` tetap tersimpan dan dapat diklasifikasi manual |
| Retensi pelapor | ≥ 40% melapor kedua kali | Warga dengan ≥ 2 aduan dibagi total pelapor |
| **Keberhasilan pengiriman OTP** | **≥ 98% terkirim < 30 detik** | **Webhook status Resend: `email.delivered` dibagi `email.sent`** |
| **Konversi login** | **≥ 90%** | **Jumlah `auth_sessions` baru dibagi jumlah OTP yang diminta** |

---

# 2 · Aturan Wajib (Guardrails)

## 2.1 Aturan teknis absolut

| No | Aturan |
|---|---|
| **T1** | Node 20 LTS atau lebih baru. Repo ini memakai **npm** (bukan pnpm). Jangan menambahkan yarn atau pnpm — lockfile campuran akan merusak workspace. |
| **T2** | Setiap panggilan AI wajib memiliki timeout **8000 ms**, satu kali retry, dan jalur kegagalan yang tetap menyimpan data pengguna. |
| **T3** | Body text tidak pernah di bawah **16px**. Target sentuh tidak pernah di bawah **44×44 px**. Pengguna mencakup warga usia 50+ yang membuka aplikasi di pinggir jalan. |
| **T4** | Setiap tabel wajib memiliki RLS aktif. Tabel dengan RLS aktif tanpa policy sama dengan tabel tanpa akses — ini disengaja dan aman. |
| **T5** | Setiap operasi tulis dari aplikasi mobile harus tahan terhadap kondisi jaringan buruk: tampilkan status pengiriman, jangan pernah mengirim ganda saat tombol ditekan dua kali. |
| **T6** | Semua tanggal disimpan sebagai `TIMESTAMPTZ` UTC di database, ditampilkan dalam zona waktu perangkat di antarmuka. |
| **T7** | Semua uang disimpan sebagai `BIGINT` dalam satuan rupiah penuh, bukan `FLOAT`. Pembulatan mata uang tidak boleh terjadi di lapisan penyimpanan. |
| **T8** | Modul **M5 DARURAT** wajib berfungsi tanpa AI dan tanpa klasifikasi. Jika Groq mati, SOS tetap terkirim. |
| **T9** | **Token akses berumur pendek (1 jam), refresh token berumur panjang (30 hari).** Warga tidak boleh diminta login ulang lebih sering dari sebulan sekali. Setiap login menghabiskan kuota email; sesi panjang adalah keputusan biaya, bukan hanya kenyamanan. |
| **T10** | **Kode OTP tidak pernah disimpan sebagai teks biasa.** Yang tersimpan hanya hash SHA-256 dari `kode + pepper`. Perbandingan memakai fungsi waktu-tetap (constant time). |
| **T11** | **Kegagalan pengiriman email tidak boleh menghasilkan sesi.** Bila Resend menolak, kode OTP yang sudah dibuat langsung ditandai `consumed_at = NOW()` agar tidak menggantung. |

## 2.2 Aturan keamanan

> ### KUNCI API & RAHASIA — TIDAK DAPAT DINEGOSIASIKAN
>
> `GROQ_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, dan `OTP_PEPPER` hanya boleh berada di **Supabase Edge Function secrets**. Tidak satu pun boleh muncul di `apps/mobile`, di variabel berawalan `EXPO_PUBLIC_*`, atau di berkas yang ter-commit. Sebuah APK dapat dibongkar dalam hitungan menit dan seluruh string di dalamnya terbaca.
>
> `SUPABASE_JWT_SECRET` adalah yang paling berbahaya di daftar ini: siapa pun yang memilikinya dapat menandatangani token atas nama warga mana pun, termasuk admin, dan seluruh RLS menjadi tidak berarti.

| No | Aturan |
|---|---|
| **S1** | `EXPO_PUBLIC_SUPABASE_ANON_KEY` aman berada di bundel aplikasi. Perlindungan datanya adalah RLS, bukan kerahasiaan key. |
| **S2** | Edge Function wajib memverifikasi header `Authorization` dan memastikan pemanggil adalah pemilik data sebelum melakukan perubahan. Pengecualian: `auth-request-otp` dan `auth-verify-otp`, yang memang publik dan karenanya wajib memiliki rate limit sendiri. |
| **S3** | Foto aduan diunggah ke folder `{user_id}/` di bucket storage. Policy storage memastikan warga hanya dapat menulis ke foldernya sendiri. |
| **S4** | Kolom peran (`role`) pada tabel `profiles` tidak boleh dapat diubah oleh pemiliknya sendiri. Policy UPDATE harus mengunci nilai `role`. |
| **S5** | Dokumen identitas (KTP/KK) pada modul M4 disimpan di bucket privat, diakses melalui signed URL berumur pendek, tidak pernah publik. |
| **S6** | Alamat email dan nomor telepon warga tidak pernah ditampilkan di feed publik. Yang tampil hanya nama depan dan kelurahan. Email disimpan di tabel `users` yang terpisah dari `profiles`, dan hanya dapat dibaca pemiliknya sendiri. |
| **S7** | **OTP: enam digit, berlaku 10 menit, maksimal 5 percobaan salah, satu kode aktif per email.** Meminta kode baru membatalkan kode sebelumnya. |
| **S8** | **Rate limit `auth-request-otp`: maksimal 3 permintaan per email per jam dan 10 per alamat IP per jam.** Jeda kirim ulang minimal 60 detik. Ditegakkan di database, bukan di memori Edge Function — Edge Function bersifat stateless dan dapat berjalan di banyak instans. |
| **S9** | **Jangan membocorkan keberadaan akun.** Respons `auth-request-otp` selalu sama persis, baik email terdaftar maupun tidak: `{ ok: true, cooldownSeconds: 60 }`. Verifikasi kode salah dan email tidak dikenal menghasilkan pesan yang identik. |
| **S10** | **Refresh token disimpan sebagai hash di database dan berotasi setiap kali dipakai.** Refresh token lama langsung dicabut. Pemakaian ulang token yang sudah dicabut mencabut seluruh sesi pengguna itu — tanda token dicuri. |
| **S11** | Refresh token di perangkat disimpan di `expo-secure-store` (Keychain/Keystore), **tidak pernah** di `AsyncStorage`. Access token cukup di memori. |
| **S12** | JWT yang diterbitkan wajib memuat klaim `sub`, `role: 'authenticated'`, `aud: 'authenticated'`, `iat`, dan `exp`. Klaim `role` **tidak pernah** diisi peran domain SIGAP (`admin`, `verifier`, dan seterusnya) — peran domain dibaca dari tabel `profiles` oleh fungsi RLS, agar perubahan peran berlaku seketika tanpa menunggu token diperbarui. |

## 2.3 Aturan bahasa & penamaan

| Konteks | Bahasa | Contoh |
|---|---|---|
| Teks antarmuka, pesan error, notifikasi, isi email | Indonesia | "Ada masalah apa?", "Foto dulu, sisanya kami bantu isi." |
| Nama variabel, fungsi, komponen | Inggris | `useCreateComplaint`, `uploadComplaintPhoto` |
| Nama tabel & kolom database | Inggris, `snake_case` | `complaints.assigned_dinas`, `sla_due_at` |
| Nilai enum domain lokal | Indonesia, `snake_case` | `jalan_rusak`, `pohon_tumbang`, `pkl_liar` |
| Commit message | Inggris | `feat(mobile): add complaint creation flow` |
| Komentar kode | Indonesia | `// Simpan dulu. Aduan tidak boleh hilang karena AI mati.` |

> ### NADA BAHASA ANTARMUKA
>
> Gunakan bahasa manusia, bukan bahasa formulir pemerintah. Tulis "Ada masalah apa?" bukan "Uraian Aduan". Tulis "Laporan Anda sudah sampai ke Dinas Pekerjaan Umum" bukan "Status: Terdisposisi".
>
> Hindari kata: *uraian, disposisi, perihal, dimaksud, adapun, sehubungan dengan*.

## 2.4 Larangan

- Dilarang menaruh logika otorisasi hanya di React Native tanpa policy RLS pendamping.
- Dilarang memanggil API Groq, Gemini, atau Resend langsung dari aplikasi mobile.
- Dilarang menyimpan poin sebagai kolom `total_points` yang di-increment. Poin wajib berupa ledger.
- Dilarang menggunakan `FLOAT` untuk nilai anggaran.
- Dilarang menampilkan spinner tanpa konteks. Setiap keadaan memuat harus menjelaskan apa yang sedang terjadi.
- Dilarang memblokir pengiriman aduan hanya karena AI belum merespons.
- Dilarang menggunakan warna merah untuk apa pun selain darurat dan kesalahan.
- **Dilarang memakai `supabase.auth.*` di mana pun.** Modul itu tidak dipakai di SIGAP. Sesi dikelola `useAuth` sendiri. Satu-satunya sentuhan ke Supabase Auth adalah: tidak ada.
- **Dilarang menaruh peran domain di dalam klaim JWT.** Peran dibaca dari `profiles` oleh fungsi `current_role_name()`.
- **Dilarang mengirim email apa pun di luar Edge Function.** Kuota email terbatas dan setiap pengiriman harus dapat dilacak.

---

# 3 · Persona & Peran

## 3.1 Persona pengguna

| Persona | Konteks pemakaian | Kebutuhan utama |
|---|---|---|
| **Bu Sri, 52** — Pedagang, warga kelurahan | Membuka aplikasi sambil berdiri di pinggir jalan, tangan satu memegang telepon, sinyal 3G | Alur sesingkat mungkin: foto, satu kalimat, kirim. Teks besar. Tahu laporannya sampai ke mana. |
| **Rian, 24** — Mahasiswa, aktif komunitas | Membuka aplikasi beberapa kali sehari, mengikuti isu kelurahan | Feed, voting aspirasi, leaderboard, data anggaran yang bisa ditelusuri |
| **Pak Deni, 38** — Staf Dinas PUPR | Dashboard web di kantor, mengerjakan antrean aduan dinasnya | Antrean terurut prioritas, SLA jelas, unggah foto progres cepat |
| **Ibu Wulan, 45** — Verifikator kecamatan | Menyaring aduan masuk sebelum diteruskan | Koreksi klasifikasi AI dalam satu ketukan, tolak aduan palsu dengan alasan |
| **Operator piket, 30** — Pusat kendali darurat | Layar selalu menyala, memantau antrean SOS | Notifikasi berbunyi, peta lokasi, audio, tombol "sedang merespons" |

> ### RISIKO PERSONA YANG DISADARI — OTP EMAIL
>
> Bu Sri adalah persona yang paling mungkin tidak hafal alamat emailnya, atau tidak punya aplikasi email terpasang di ponselnya. Ini konsekuensi nyata dari memilih email di atas SMS, dan dokumen ini tidak berpura-pura sebaliknya.
>
> Tiga mitigasi wajib diterapkan, bukan opsional:
> 1. **Sesi 30 hari (T9).** Bu Sri login sekali, lalu tidak diminta login lagi selama sebulan penuh. Titik gesekan hanya terjadi satu kali.
> 2. **Tombol "Buka aplikasi email"** di layar OTP, memakai `Linking.openURL('message:')` di iOS dan intent `android.intent.action.MAIN` kategori `APP_EMAIL` di Android. Warga tidak perlu tahu cara berpindah aplikasi.
> 3. **Kode enam digit, bukan magic link.** Magic link yang dibuka di browser akan kehilangan konteks aplikasi dan memutus sesi. Kode dapat dibaca dan diketik ulang.
>
> Kolom `phone` tetap ada di `profiles` sebagai data opsional. Bila di kemudian hari SMS gateway tersedia, jalur OTP SMS dapat ditambahkan tanpa mengubah skema apa pun — lihat Bagian 15.1.

## 3.2 Peran sistem & kewenangan

| Peran (enum `user_role`) | Kewenangan |
|---|---|
| `citizen` | Membuat aduan, aspirasi, permohonan layanan, SOS. Mendukung laporan dan memilih aspirasi. Melihat seluruh data publik. Mengubah profilnya sendiri kecuali kolom `role`. |
| `verifier` | Semua kewenangan `citizen`, ditambah: memverifikasi atau menolak aduan, mengoreksi hasil klasifikasi AI, menandai duplikat. |
| `dinas_staff` | Membaca dan memperbarui aduan dinasnya sendiri. Menambah entri timeline dengan foto progres. Tidak dapat mengubah `assigned_dinas`. |
| `dinas_head` | Semua kewenangan `dinas_staff`, ditambah: menyetujui jawaban resmi, melihat rekap SLA dinasnya, memindahkan aduan ke dinas lain. |
| `emergency_operator` | Membaca seluruh `emergency_alerts`, menandai status `responding` dan `resolved`. Tidak memiliki akses ke modul anggaran. |
| `admin` | Semua kewenangan. Mengimpor data APBD, mengelola pengguna dan peran, membuka/menutup periode voting. |

> ### ATURAN RLS TURUNAN
>
> `dinas_staff` dan `dinas_head` hanya boleh `SELECT` dan `UPDATE` baris `complaints` dengan `assigned_dinas = current_dinas_id()`. Fungsi `current_dinas_id()` membaca kolom `dinas_id` dari tabel `profiles`, **bukan** dari klaim JWT — agar perubahan penugasan berlaku seketika tanpa menunggu token diperbarui.
>
> Prinsip yang sama berlaku untuk peran. Inilah alasan S12 melarang menaruh peran domain di dalam token: token berumur satu jam, sedangkan pencabutan peran harus berlaku dalam hitungan detik.
---

# 4 · Arsitektur

## 4.1 Diagram sistem

```
┌────────────────────┐            ┌────────────────────┐
│   apps/mobile      │            │   apps/admin       │
│   Expo SDK 51      │            │   Next.js 14       │
│   React Native 0.74│            │   App Router       │
│   Expo Router v3   │            │  (dashboard petugas)│
└─────────┬──────────┘            └─────────┬──────────┘
          │  anon key + JWT SIGAP           │
          └───────────────┬─────────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
        ▼                                    ▼
┌──────────────────────────┐   ┌───────────────────────────────────┐
│   Edge Functions (Deno)  │   │      S U P A B A S E              │
│                          │   │  PostgreSQL 15                    │
│  AUTH (bukan AI)         │   │   ├── pgvector (duplikat, RAG)    │
│   auth-request-otp       │   │   ├── cube + earthdistance (geo)  │
│   auth-verify-otp        │──▶│   └── Row Level Security          │
│   auth-refresh           │   │  Realtime (timeline, antrean SOS) │
│   auth-signout           │   │  Storage (foto, dokumen, audio)   │
│                          │   │                                   │
│  AI                      │   │  auth.users — TIDAK DIPAKAI       │
│   classify-report        │   └───────────────────────────────────┘
│   embed-text             │        ▲
│   draft-response         │        │ service role key
│   ask-budget (RAG)       │        │ (server-side saja)
│   ocr-doc                │        │
│   dispatch-emergency     │────────┘
└──────┬──────────┬────────┘
       │          │
       │          │ GROQ_API_KEY / GEMINI_API_KEY (secret)
       │          ▼
       │   ┌───────────────────────────────────┐
       │   │  Groq Cloud                       │
       │   │   llama-3.3-70b-versatile         │
       │   │  Google AI                        │
       │   │   gemini-2.0-flash (vision/OCR)   │
       │   └───────────────────────────────────┘
       │
       │ RESEND_API_KEY (secret)
       ▼
┌───────────────────────────────────┐
│  Resend                           │
│   Email OTP masuk                 │
│   Email notifikasi (terbatas)     │
└───────────────────────────────────┘
```

> ### PRINSIP ARSITEKTUR
>
> **Aplikasi mobile hanya mengenal dua hal: Supabase dan Edge Function SIGAP.** Mobile tidak pernah berbicara langsung dengan Groq, Gemini, maupun Resend. Setiap kemampuan pihak ketiga diekspos sebagai satu Edge Function dengan kontrak JSON yang tetap. Ini membuat penggantian penyedia AI atau penyedia email di kemudian hari tidak memerlukan rilis aplikasi baru di Play Store.
>
> **Supabase dipakai sebagai database, storage, dan realtime — bukan sebagai penyedia identitas.** Skema `auth` tetap ada di proyek Supabase (tidak dapat dinonaktifkan), tetapi SIGAP tidak menulis satu baris pun ke `auth.users`. Identitas ada di tabel `public.users` milik kita sendiri.

## 4.2 Bagaimana RLS tetap berfungsi tanpa Supabase Auth

Ini adalah bagian terpenting dari perubahan v2.0. Bacalah sampai selesai sebelum menyentuh Bagian 6.

PostgREST — lapisan yang melayani seluruh query `supabase-js` — tidak peduli siapa yang membuat JWT. Ia hanya memeriksa **tanda tangan** token terhadap kunci milik proyek, lalu menaruh isi token ke dalam `request.jwt.claims`. Fungsi `auth.uid()` di dalam policy RLS tidak lebih dari pembacaan klaim `sub` dari setting tersebut:

```sql
-- Kira-kira seperti inilah auth.uid() bekerja di dalam Postgres:
SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
```

Konsekuensinya: **selama Edge Function kita menandatangani token dengan kunci milik proyek Supabase, seluruh policy RLS pada Bagian 6.6 berjalan apa adanya, tanpa satu baris pun diubah.** Ini yang membuat perubahan v2.0 murah.

**Alur token:**

```
1. Warga memasukkan email
      │
      ▼
2. auth-request-otp  → buat kode, simpan hash, kirim lewat Resend
      │
      ▼
3. Warga memasukkan enam digit
      │
      ▼
4. auth-verify-otp   → cocokkan hash
                     → buat/ambil baris users + profiles
                     → TANDATANGANI JWT dengan SUPABASE_JWT_SECRET
                     → { accessToken (1 jam), refreshToken (30 hari) }
      │
      ▼
5. supabase-js memakai accessToken lewat opsi `accessToken`
      │
      ▼
6. PostgREST memverifikasi tanda tangan → mengisi request.jwt.claims
      │
      ▼
7. auth.uid() di dalam policy RLS mengembalikan users.id → policy berjalan normal
```

**Klaim wajib di dalam token:**

```json
{
  "sub": "0f9c1b2e-...",       // users.id — dibaca auth.uid()
  "role": "authenticated",      // peran POSTGRES, bukan peran SIGAP
  "aud": "authenticated",
  "iat": 1754784000,
  "exp": 1754787600
}
```

> ### TIGA JEBAKAN YANG WAJIB DIVERIFIKASI DI SPRINT 1
>
> **1. Klaim `role` harus berisi `authenticated`, bukan peran SIGAP.** `role` di sini adalah peran Postgres yang dipakai PostgREST untuk `SET LOCAL ROLE`. Mengisinya dengan `admin` akan membuat PostgREST gagal karena peran itu tidak ada, atau — lebih buruk — berhasil bila kebetulan ada. Peran SIGAP dibaca dari tabel `profiles` (aturan S12).
>
> **2. Proyek yang memakai JWT signing key asimetris membutuhkan header `kid`.** Bila proyek Supabase Anda sudah memakai signing key generasi baru (bukan lagi legacy JWT secret HS256), token wajib memuat `kid` yang cocok dengan kunci di JWKS proyek, dan ditandatangani dengan algoritma asimetris. Task 1.6 mewajibkan Anda memastikan mana yang berlaku di proyek Anda **sebelum** menulis kode sesi. Bila legacy HS256 masih aktif, pakai itu — lebih sederhana. Bila tidak, ambil kunci privat dari pengaturan proyek dan tandatangani dengan ES256 beserta `kid`.
>
> **3. Realtime memerlukan token yang di-set secara eksplisit.** `supabase.realtime.setAuth(accessToken)` wajib dipanggil setiap kali token berganti, kalau tidak koneksi Realtime akan jatuh ke peran `anon` dan langganan timeline (M1) serta antrean SOS (M5) akan sunyi tanpa pesan error. Ini penyebab bug paling sering pada arsitektur ini.

**Client factory yang benar:**

```ts
// packages/supabase/src/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * getAccessToken dipanggil setiap kali supabase-js perlu token.
 * Implementasinya ada di apps/mobile/src/lib/session.ts dan bertugas
 * menyegarkan token yang hampir kedaluwarsa sebelum mengembalikannya.
 */
export function createSigapClient(
  url: string,
  anonKey: string,
  getAccessToken: () => Promise<string | null>,
) {
  return createClient<Database>(url, anonKey, {
    accessToken: async () => (await getAccessToken()) ?? '',
    auth: {
      // Modul auth bawaan dimatikan total. SIGAP mengelola sesinya sendiri.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

## 4.3 Struktur monorepo

```
sigap/
├── package.json                 Root workspace, script turbo
├── pnpm-workspace.yaml
├── turbo.json
├── .nvmrc                       "20"
├── .gitignore
│
├── apps/
│   ├── mobile/                  Expo — aplikasi warga
│   │   ├── app/                 Rute Expo Router (file-based)
│   │   │   ├── _layout.tsx      AuthProvider + AuthGate
│   │   │   ├── (auth)/
│   │   │   │   ├── login.tsx            Email
│   │   │   │   ├── verify.tsx           Enam digit OTP
│   │   │   │   └── onboarding.tsx       Nama, kelurahan, kecamatan
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx          Tab bar 5 item
│   │   │   │   ├── index.tsx            Beranda
│   │   │   │   ├── feed.tsx             Peta + daftar aduan
│   │   │   │   ├── report.tsx           Buat aduan (aksi utama)
│   │   │   │   ├── aspirasi.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── report/
│   │   │   │   ├── review.tsx           Konfirmasi hasil AI
│   │   │   │   ├── duplicate.tsx        Tawaran dukung laporan yang ada
│   │   │   │   └── [id].tsx             Detail + timeline
│   │   │   ├── aspirasi/
│   │   │   │   ├── new.tsx
│   │   │   │   ├── [id].tsx
│   │   │   │   ├── [id]/impact.tsx
│   │   │   │   └── musrenbang.tsx
│   │   │   ├── budget/
│   │   │   │   ├── index.tsx            Treemap APBD
│   │   │   │   ├── [dinas].tsx
│   │   │   │   ├── project/[id].tsx
│   │   │   │   └── ask.tsx              Tanya AI
│   │   │   ├── service/
│   │   │   │   ├── index.tsx            Katalog layanan
│   │   │   │   ├── [type]/apply.tsx
│   │   │   │   ├── track/[id].tsx
│   │   │   │   └── doc/[id].tsx
│   │   │   ├── sos/
│   │   │   │   ├── index.tsx            Tekan-tahan
│   │   │   │   ├── type.tsx
│   │   │   │   └── [id].tsx             Status respons
│   │   │   ├── info/index.tsx
│   │   │   └── leaderboard.tsx
│   │   └── src/
│   │       ├── components/      Komponen UI (Bagian 5.4)
│   │       ├── hooks/           Hook data per modul
│   │       ├── lib/             supabase.ts, session.ts, upload.ts, format.ts
│   │       └── i18n/copy.ts     Seluruh string antarmuka
│   │
│   └── admin/                   Next.js 14 — dashboard petugas
│
├── packages/
│   ├── shared/src/
│   │   ├── theme.ts             Token warna, tipografi, spacing
│   │   ├── constants.ts         Dinas, kategori, SLA, poin, konstanta auth
│   │   ├── schemas.ts           Skema Zod seluruh modul
│   │   ├── types.ts             Tipe domain lintas app
│   │   └── index.ts
│   ├── supabase/src/
│   │   ├── client.ts            Factory client (lihat 4.2)
│   │   ├── database.types.ts    Hasil generate dari skema
│   │   ├── queries/             complaints.ts, aspirations.ts, budget.ts
│   │   └── index.ts
│   └── ai/src/
│       ├── prompts.ts           Template prompt (versi TypeScript)
│       └── types.ts             Tipe respons AI
│
└── supabase/
    ├── config.toml
    ├── seed.sql
    ├── migrations/
    │   ├── 20260810000001_extensions.sql
    │   ├── 20260810000002_identity.sql        ← BARU: users, otp, sessions
    │   ├── 20260810000003_core_tables.sql
    │   ├── 20260810000004_modules.sql
    │   ├── 20260810000005_functions.sql
    │   ├── 20260810000006_rls.sql
    │   └── 20260810000007_storage.sql
    └── functions/
        ├── _shared/     groq.ts · gemini.ts · resend.ts · jwt.ts · otp.ts
        │                prompts.ts · email-templates.ts · cors.ts
        ├── auth-request-otp/index.ts
        ├── auth-verify-otp/index.ts
        ├── auth-refresh/index.ts
        ├── auth-signout/index.ts
        ├── classify-report/index.ts
        ├── embed-text/index.ts
        ├── draft-response/index.ts
        ├── ask-budget/index.ts
        ├── ocr-doc/index.ts
        └── dispatch-emergency/index.ts
```

## 4.4 Dependensi & versi terkunci

> ### JANGAN MENAIKKAN VERSI MAYOR
>
> Versi di bawah ini sudah diuji saling kompatibel. Expo SDK 51 mengikat React Native 0.74 dan React 18.2. Menaikkan salah satunya akan memutus yang lain. Jika sebuah paket gagal diinstal, laporkan — jangan diam-diam mengganti dengan alternatif.

| Paket | Versi | Kegunaan |
|---|---|---|
| **Root & tooling** | | |
| `pnpm` | 9.12.0 | Package manager, dikunci lewat `packageManager` |
| `turbo` | ^2.1.3 | Orkestrasi build/test/lint |
| `typescript` | ^5.5.4 | Bahasa, mode strict wajib |
| `vitest` | ^2.1.1 | Test untuk package non-RN |
| **apps/mobile** | | |
| `expo` | ~51.0.0 | SDK 51 |
| `react-native` | 0.74.5 | Terikat SDK 51 |
| `react` | 18.2.0 | Terikat RN 0.74 |
| `expo-router` | ~3.5.0 | Navigasi berbasis file |
| `expo-location` | ~17.0.0 | GPS titik aduan & SOS, **dan reverse geocode bawaan OS** |
| `expo-image-picker` | ~15.0.0 | Kamera & galeri |
| `expo-image-manipulator` | ~12.0.0 | Kompresi foto sebelum unggah |
| `expo-av` | ~14.0.0 | Rekam audio 10 detik pada SOS |
| `expo-notifications` | ~0.28.0 | Push status aduan |
| `expo-secure-store` | ~13.0.0 | **Penyimpanan refresh token (S11)** |
| `expo-linking` | ~6.3.0 | **Tombol "Buka aplikasi email" di layar OTP** |
| `@react-native-async-storage/async-storage` | 1.23.1 | Cache React Query & draf aduan luring. **Bukan lagi adapter sesi Supabase.** |
| `react-native-maps` | 1.14.0 | Peta feed & pemilih lokasi |
| `react-native-svg` | 15.2.0 | Ikon & treemap anggaran |
| `@tanstack/react-query` | ^5.51.0 | Cache data, retry, optimistic update |
| `react-native-url-polyfill` | ^2.0.0 | Wajib untuk supabase-js di RN |
| `date-fns` | ^3.6.0 | Format tanggal & countdown SLA, locale `id` |
| **Backend** | | |
| `@supabase/supabase-js` | ^2.45.4 | Client, dipakai di semua app. **Minimal 2.45 — opsi `accessToken` diperlukan.** |
| `zod` | ^3.23.8 | Validasi input lintas lapisan |
| Supabase CLI | ≥ 1.190 | Migrasi, generate tipe, serve function |
| Deno | ≥ 1.45 | Runtime Edge Function |
| **apps/admin (tambahan)** | | |
| `next` | 14.2.x | Dashboard petugas |
| `maplibre-gl` | ^4.7.0 | **Peta dashboard — pengganti Mapbox, lisensi BSD, tanpa API key** |

### Impor Deno yang diizinkan di Edge Function

Aturan R7 berlaku untuk `package.json`. Edge Function memakai impor URL, dan hanya tiga berikut yang diizinkan:

| Impor | Kegunaan |
|---|---|
| `https://esm.sh/@supabase/supabase-js@2` | Client service role di dalam function |
| `https://deno.land/x/djwt@v3.0.2/mod.ts` | Menandatangani & memverifikasi JWT sesi |
| `https://deno.land/std@0.224.0/...` | `assert` untuk test, `crypto` untuk hash OTP |

Resend **tidak** memakai SDK. Ia dipanggil dengan `fetch` biasa di `_shared/resend.ts` — satu endpoint POST, tidak sebanding dengan biaya menambah dependensi.

## 4.5 Variabel lingkungan

| Variabel | Lokasi | Catatan |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | Publik, aman di bundel |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Publik, dilindungi RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets | **RAHASIA** Melewati RLS |
| `SUPABASE_JWT_SECRET` | Edge Function secrets | **RAHASIA — PALING BERBAHAYA.** Menandatangani token sesi |
| `SUPABASE_JWT_KID` | Edge Function secrets | Diisi hanya bila proyek memakai signing key asimetris (lihat 4.2) |
| `RESEND_API_KEY` | Edge Function secrets | **RAHASIA** |
| `RESEND_FROM_EMAIL` | Edge Function secrets | Contoh: `SIGAP <halo@sigap.example.id>`. Domain wajib terverifikasi di Resend |
| `OTP_PEPPER` | Edge Function secrets | **RAHASIA** String acak ≥ 32 byte, dicampur sebelum hashing OTP |
| `GROQ_API_KEY` | Edge Function secrets | **RAHASIA** |
| `GEMINI_API_KEY` | Edge Function secrets | **RAHASIA** Untuk OCR M4 |
| `GOOGLE_MAPS_ANDROID_KEY` | `apps/mobile/app.json` | Wajib untuk peta Android. Dibatasi ke SHA-1 + package name. Lihat 4.6 |

```bash
# apps/mobile/.env.example — satu-satunya file env yang boleh di-commit
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=isi_dari_perintah_supabase_status
```

```bash
# supabase/.env.local — TIDAK di-commit, tercakup pola .env di .gitignore
SUPABASE_JWT_SECRET=isi_dari_perintah_supabase_status
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="SIGAP <halo@sigap.example.id>"
OTP_PEPPER=hasil_dari_openssl_rand_-hex_32
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxx
```

```bash
# Perintah untuk membuat pepper. Jangan mengarang string sendiri.
openssl rand -hex 32
```

## 4.6 Keputusan peta

Peta dipilih dengan satu syarat: **biaya nol pada volume lomba dan pilot, tanpa mengubah daftar dependensi mobile.**

| Lapisan | Pilihan | Biaya | Alasan |
|---|---|---|---|
| Peta mobile Android | `react-native-maps` → Google Maps SDK for Android | **Rp 0, tanpa batas** | SKU *Mobile Native Dynamic Maps* berharga nol dan tidak berkuota. Yang dibutuhkan hanya API key; billing account harus aktif meskipun tagihannya nol |
| Peta mobile iOS | `react-native-maps` dengan `PROVIDER_DEFAULT` → Apple Maps | **Rp 0** | Tidak butuh API key, tidak butuh akun billing sama sekali |
| Peta dashboard web | MapLibre GL JS + penyedia tile gratis | **Rp 0** pada volume pilot | MapLibre berlisensi BSD dan tidak butuh API key. Tile diambil dari penyedia gratis (OpenFreeMap, atau MapTiler tier gratis bila butuh SLA) |
| Reverse geocode | `Location.reverseGeocodeAsync()` dari `expo-location` | **Rp 0** | Memakai geocoder bawaan sistem operasi. Tidak ada API key, tidak ada kuota, tidak menambah dependensi |
| Geocode di dashboard | Nominatim (OSM) | **Rp 0** | Wajib mengirim header `User-Agent` berisi kontak, maksimal 1 permintaan/detik, hasil di-cache di `budget_items.location_address` |

> ### PERINGATAN BIAYA YANG SERING TERLEWAT
>
> Yang gratis tanpa batas hanyalah **peta dinamis di SDK mobile**. Yang berbayar adalah layanan berbasis permintaan: Geocoding API, Places API, Directions API, dan Dynamic Maps versi **web**. SIGAP tidak memakai satu pun dari lima itu — reverse geocode diserahkan ke OS, dashboard memakai MapLibre.
>
> Bila suatu saat ada yang menambahkan Places Autocomplete "supaya pencarian alamat lebih enak", biaya berubah dari nol menjadi per permintaan. Perubahan seperti itu wajib melewati Bagian 15 terlebih dahulu.

```jsonc
// apps/mobile/app.json — potongan yang relevan
{
  "expo": {
    "ios":     { "supportsTablet": false },
    "android": {
      "config": {
        "googleMaps": { "apiKey": "$GOOGLE_MAPS_ANDROID_KEY" }
      },
      "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "RECORD_AUDIO", "CAMERA"]
    },
    "plugins": [
      "expo-router",
      ["expo-location", {
        "locationAlwaysAndWhenInUsePermission":
          "SIGAP butuh izin lokasi untuk menandai titik aduan di peta."
      }],
      ["expo-image-picker", {
        "photosPermission": "SIGAP butuh akses foto untuk melampirkan bukti aduan.",
        "cameraPermission": "SIGAP butuh izin kamera untuk memotret bukti aduan."
      }],
      ["expo-av", {
        "microphonePermission": "SIGAP merekam 10 detik suara saat SOS agar operator memahami situasi."
      }]
    ]
  }
}
```

Pada iOS, `<MapView>` dipakai **tanpa** prop `provider` sehingga jatuh ke Apple Maps. Pada Android, `react-native-maps` selalu memakai Google — tidak ada pilihan lain, dan itu tidak masalah karena tarifnya nol.

---

# 5 · Design System

## 5.1 Prinsip desain

| Prinsip | Penerapan konkret |
|---|---|
| **Bukti di atas janji** | Setiap layar menjawab "apa yang terjadi dengan laporan saya?". Timeline selalu menampilkan foto dan nama petugas, bukan sekadar label status. |
| **Satu aksi per layar** | Warga di pinggir jalan tidak akan mengisi dua belas kolom. Layar buat aduan hanya punya satu kolom teks; sisanya diisi kamera, GPS, dan AI. |
| **Peta adalah bahasa utama** | Masalah publik selalu punya lokasi. Feed, anggaran, dan darurat semuanya berbasis peta terlebih dahulu, daftar kemudian. |
| **Warna membawa arti** | Merah selalu berarti darurat atau kesalahan — tidak pernah dipakai sebagai aksen dekoratif. Warna semantik terpisah total dari warna brand. |
| **Bahasa visual sipil** | Rujukannya peta, data, bukti, dan progres — bukan kartu promosi ala e-commerce atau saldo ala aplikasi bank. |

## 5.2 Token warna

Arah palet: teal-indigo, sengaja menghindari biru pemerintah generik `#0066CC`. Warna `#0F4C5C` memberi kontras 9,8:1 terhadap teks putih (WCAG AAA) dan tidak tertukar dengan warna partai politik mana pun.

### Brand — mode terang

| Token | Hex | Pemakaian |
|---|---|---|
| `primary` | `#0F4C5C` | Header, tombol utama, navigasi aktif |
| `primaryPressed` | `#0A3644` | State tekan tombol utama |
| `primarySurface` | `#E6F2F5` | Kartu terpilih, badge lembut |
| `accent` | `#14B8A6` | Progres, CTA sekunder, indikator aktif |
| `accentSurface` | `#CCFBF1` | Latar highlight |
| `civicAmber` | `#F59E0B` | Gamifikasi, poin, leaderboard |
| `textPrimary` | `#0F172A` | Judul dan isi utama |
| `textSecondary` | `#475569` | Keterangan pendukung |
| `textMuted` | `#94A3B8` | Placeholder, metadata |
| `border` | `#E2E8F0` | Garis pemisah, tepi input |
| `surface` | `#FFFFFF` | Kartu, sheet, tab bar |
| `background` | `#F8FAFC` | Latar layar |

### Brand — mode gelap

> ### WAJIB DIPERHATIKAN
>
> `#0F4C5C` terlalu gelap untuk latar gelap. Di mode gelap, `primary` harus naik ke `#2DD4BF`. Jika tidak, tombol utama akan lenyap ke dalam latar.

| Token | Hex | Token | Hex |
|---|---|---|---|
| `background` | `#0B1620` | `textPrimary` | `#F1F5F9` |
| `surface` | `#142430` | `textSecondary` | `#94A3B8` |
| `border` | `#1E3441` | `textMuted` | `#64748B` |
| `primary` | `#2DD4BF` | `primaryPressed` | `#14B8A6` |
| `accent` | `#5EEAD4` | `primarySurface` | `#134E4A` |
| `accentSurface` | `#134E4A` | `civicAmber` | `#FBBF24` |

### Semantik — terpisah dari brand

| Makna | FG terang | BG terang | FG gelap | BG gelap |
|---|---|---|---|---|
| P0 Darurat < 24 jam | `#DC2626` | `#FEF2F2` | `#F87171` | `#3B1416` |
| P1 Penting < 72 jam | `#EA580C` | `#FFF7ED` | `#FB923C` | `#3A1E0A` |
| P2 Normal < 7 hari | `#0284C7` | `#EFF6FF` | `#60A5FA` | `#12253C` |
| Menunggu | `#64748B` | `#F8FAFC` | `#94A3B8` | `#1B2A36` |
| Terverifikasi | `#0284C7` | `#EFF6FF` | `#60A5FA` | `#12253C` |
| Diproses | `#CA8A04` | `#FEFCE8` | `#FACC15` | `#332A08` |
| Selesai | `#16A34A` | `#F0FDF4` | `#4ADE80` | `#0C2A16` |
| Ditolak | `#64748B` | `#F8FAFC` | `#94A3B8` | `#1B2A36` |

## 5.3 Tipografi & spacing

| Peran | Ukuran / tinggi baris | Bobot | Pemakaian |
|---|---|---|---|
| `display` | 28 / 34 | 800 | Judul layar utama, angka besar |
| `h1` | 22 / 28 | 700 | Judul layar |
| `h2` | 18 / 24 | 600 | Judul kartu, label tombol utama |
| `body` | 16 / 24 | 400 | Isi. Tidak pernah di bawah 16. |
| `caption` | 14 / 20 | 400 | Keterangan, label input |
| `micro` | 12 / 16 | 500 | Label tab, timestamp, badge |

Font: **Plus Jakarta Sans** untuk display dan judul (bobot 700/800), **Inter** untuk body dan UI (400/500/600). Angka dan data memakai Inter dengan `fontVariant: ['tabular-nums']` agar kolom angka tidak bergoyang.

Spacing memakai fungsi `spacing(n) = n * 4`. Nilai yang boleh dipakai: 1, 2, 3, 4, 5, 6, 8, 10, 12 — yang berarti 4, 8, 12, 16, 20, 24, 32, 40, 48 piksel. Radius sudut: kartu `spacing(3)`, tombol `spacing(3)`, sheet `spacing(5)`, avatar penuh.

### Implementasi `packages/shared/src/theme.ts`

```ts
export type ThemeMode = 'light' | 'dark';
export type Urgency = 'P0' | 'P1' | 'P2';
export type ComplaintStatus =
  | 'pending_classification' | 'pending' | 'verified'
  | 'in_progress' | 'resolved' | 'rejected';

export interface ColorTokens {
  primary: string; primaryPressed: string; primarySurface: string;
  accent: string; accentSurface: string; civicAmber: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string; surface: string; background: string;
}

export const colors: Record<ThemeMode, ColorTokens> = {
  light: {
    primary: '#0F4C5C', primaryPressed: '#0A3644', primarySurface: '#E6F2F5',
    accent: '#14B8A6', accentSurface: '#CCFBF1', civicAmber: '#F59E0B',
    textPrimary: '#0F172A', textSecondary: '#475569', textMuted: '#94A3B8',
    border: '#E2E8F0', surface: '#FFFFFF', background: '#F8FAFC',
  },
  dark: {
    primary: '#2DD4BF', primaryPressed: '#14B8A6', primarySurface: '#134E4A',
    accent: '#5EEAD4', accentSurface: '#134E4A', civicAmber: '#FBBF24',
    textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#64748B',
    border: '#1E3441', surface: '#142430', background: '#0B1620',
  },
};

interface Pair { fg: string; bg: string }

const URGENCY: Record<Urgency, Record<ThemeMode, Pair>> = {
  P0: { light: { fg: '#DC2626', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  P1: { light: { fg: '#EA580C', bg: '#FFF7ED' }, dark: { fg: '#FB923C', bg: '#3A1E0A' } },
  P2: { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
};

const STATUS: Record<ComplaintStatus, Record<ThemeMode, Pair>> = {
  pending_classification: { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  pending:                { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  verified:               { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  in_progress:            { light: { fg: '#CA8A04', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  resolved:               { light: { fg: '#16A34A', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:               { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

export const urgencyColor = (u: Urgency, m: ThemeMode): Pair => URGENCY[u][m];
export const statusColor  = (s: ComplaintStatus, m: ThemeMode): Pair => STATUS[s][m];

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  h1:      { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h2:      { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  micro:   { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};

export const spacing = (n: number): number => n * 4;
```

### Test wajib untuk `theme.ts`

```ts
// packages/shared/src/theme.test.ts
import { describe, it, expect } from 'vitest';
import { colors, urgencyColor, statusColor, typography, spacing } from './theme';

describe('theme', () => {
  it('primary di mode gelap lebih terang daripada mode terang', () => {
    expect(colors.light.primary).toBe('#0F4C5C');
    expect(colors.dark.primary).toBe('#2DD4BF');
  });

  it('urgensi P0 memakai merah, bukan warna brand', () => {
    const p0 = urgencyColor('P0', 'light');
    expect(p0.fg).toBe('#DC2626');
    expect(p0.fg).not.toBe(colors.light.primary);
  });

  it('setiap status punya pasangan warna di kedua mode', () => {
    const statuses = ['pending_classification','pending','verified',
                      'in_progress','resolved','rejected'] as const;
    for (const s of statuses) {
      for (const m of ['light','dark'] as const) {
        const c = statusColor(s, m);
        expect(c.fg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(c.bg).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('body tidak pernah di bawah 16px', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('spacing memakai kelipatan 4', () => {
    expect(spacing(1)).toBe(4);
    expect(spacing(4)).toBe(16);
  });
});
```

## 5.4 Katalog komponen

Semua komponen berada di `apps/mobile/src/components/`. Setiap komponen wajib membaca mode gelap/terang melalui `useColorScheme()` dan mengambil warna dari `colors[mode]`.

| Komponen | Props | Perilaku |
|---|---|---|
| `<Button>` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'`, `label`, `onPress`, `loading`, `disabled`, `icon?` | Tinggi minimal 48. Saat `loading`, label diganti teks proses dan tombol tidak dapat ditekan ulang. Varian `danger` hanya untuk SOS dan hapus. |
| `<OtpInput>` | `value`, `onChange`, `length = 6`, `autoFocus`, `error?` | **Enam kotak terpisah, masing-masing minimal 44×44.** `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS) dan `autoComplete="sms-otp"` (Android) agar kode dapat diisi otomatis. Menempel (paste) enam digit sekaligus mengisi seluruh kotak. Kotak berubah merah saat `error`. |
| `<CooldownButton>` | `label`, `onPress`, `cooldownSeconds` | Tombol "Kirim ulang kode" yang nonaktif dan menampilkan hitung mundur detik. Dipakai di layar verifikasi OTP. |
| `<UrgencyBadge>` | `urgency: Urgency`, `size?: 'sm'\|'md'` | Menampilkan "P0 Darurat", "P1 Penting", "P2 Normal" dengan pasangan warna dari `urgencyColor`. |
| `<StatusChip>` | `status: ComplaintStatus` | Label bahasa Indonesia: Menunggu / Terverifikasi / Diproses / Selesai / Ditolak. |
| `<ComplaintCard>` | `complaint`, `onPress`, `showUpvote?` | Foto pertama, judul, badge urgensi, chip status, jarak dari pengguna, jumlah dukungan, sisa waktu SLA. |
| `<Timeline>` | `events: TimelineEvent[]` | Garis vertikal, titik berwarna sesuai jenis event, foto progres dalam baris horizontal yang dapat digeser, nama dan jabatan aktor. |
| `<SlaCountdown>` | `dueAt: string`, `resolvedAt?: string` | Hitung mundur langsung. Berubah merah bila kurang dari 20% waktu tersisa. Menampilkan "Selesai tepat waktu" atau "Terlambat X jam" bila sudah selesai. |
| `<PhotoPicker>` | `value: string[]`, `onChange`, `max = 5` | Kamera didahulukan di atas galeri. Kompres ke lebar maksimal 1280 px sebelum unggah. Tampilkan progres unggah per foto. |
| `<LocationPicker>` | `value`, `onChange` | GPS otomatis saat dibuka. Peta kecil dengan pin yang dapat digeser untuk koreksi. Alamat diisi `Location.reverseGeocodeAsync()` — **geocoder bawaan OS, bukan API berbayar**. Bila geocoder gagal, tampilkan koordinat apa adanya; jangan blokir. |
| `<MapFeed>` | `complaints`, `onSelect`, `filter` | Marker berwarna sesuai urgensi. Kluster bila lebih dari 50 titik. Sheet daftar dapat ditarik dari bawah. |
| `<EmptyState>` | `title`, `message`, `action?` | Tidak pernah hanya menulis "Tidak ada data". Selalu menjelaskan mengapa kosong dan apa langkah berikutnya. |
| `<ErrorState>` | `message`, `onRetry` | Bahasa manusia, bukan kode error. Selalu menyediakan tombol coba lagi. |
| `<AiBadge>` | `confidence: number` | Menandai bahwa isi ini dihasilkan AI. Di bawah 0,5 tampilkan "Perlu diperiksa petugas". |
| `<PointToast>` | `points`, `reason` | Muncul dari atas selama 2 detik memakai `civicAmber`. Tidak pernah menghalangi tombol. |

> ### ATURAN KOMPONEN
>
> Setiap komponen menerima `testID` opsional. Setiap elemen yang dapat disentuh wajib memiliki `accessibilityLabel` dalam bahasa Indonesia dan `accessibilityRole` yang benar. Ini bukan tambahan opsional — pengguna dengan penglihatan terbatas termasuk target pengguna aplikasi layanan publik.
>
> `<OtpInput>` punya kewajiban tambahan: enam kotak terpisah membingungkan pembaca layar bila tidak diberi label. Bungkus keseluruhannya dengan `accessibilityLabel="Kode verifikasi enam digit"` dan set `accessibilityRole="text"` pada kontainer, bukan pada tiap kotak.
---

# 6 · Model Data

> ### URUTAN MIGRASI BERSIFAT MENGIKAT
>
> Jalankan migrasi persis dalam urutan penomoran. `users` harus dibuat sebelum `profiles`; `voting_periods` dan `budget_items` harus dibuat sebelum `aspirations` karena direferensikan oleh foreign key. Menukar urutan akan menggagalkan `supabase db reset`.

## 6.1 ERD ringkas

```
users ──1:1── profiles ──N:1── dinas
  │              │
  │              ├───────────────┬────────────────┬──────────────┬─────────────┐
  │              │               │                │              │             │
  │        complaints      aspirations      service_requests  emergency_   point_ledger
  │              │               │                │            alerts
  │              ├── complaint_timeline    └── (form_data JSONB)
  │              ├── complaint_upvotes
  │              └── duplicate_of ──┐
  │                                 └──▶ complaints (self-reference)
  │
  ├── auth_otp_codes      (kode OTP ter-hash, berumur pendek)
  └── auth_sessions       (refresh token ter-hash, berotasi)

aspirations ──N:1── voting_periods
aspirations ──N:1── budget_items ──N:1── dinas
aspirations ──1:N── aspiration_votes ──N:1── profiles

announcements (mandiri)        kelurahan_leaderboard (view)
```

**Pemisahan `users` dan `profiles` disengaja.** `users` menyimpan data identitas yang tidak boleh dibaca siapa pun kecuali pemiliknya: alamat email. `profiles` menyimpan data yang memang publik: nama, kelurahan, avatar, peran. Feed, leaderboard, dan daftar pendukung aspirasi semuanya membaca `profiles` — dan karena `users` adalah tabel terpisah dengan policy sendiri, tidak ada satu pun query publik yang secara tidak sengaja ikut membawa email warga (aturan S6).

## 6.2 Migrasi 1 — ekstensi

`supabase/migrations/20260810000001_extensions.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "vector";         -- kemiripan semantik
CREATE EXTENSION IF NOT EXISTS "cube";           -- prasyarat earthdistance
CREATE EXTENSION IF NOT EXISTS "earthdistance";  -- radius geografis
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- pencarian teks toleran salah ketik
CREATE EXTENSION IF NOT EXISTS "citext";         -- email case-insensitive
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid, digest
```

## 6.3 Migrasi 2 — identitas (BARU di v2.0)

`supabase/migrations/20260810000002_identity.sql`

```sql
-- =====================================================================
-- Identitas SIGAP. Tabel ini menggantikan auth.users milik Supabase Auth.
-- auth.users TIDAK DIPAKAI dan tidak pernah ditulis oleh aplikasi ini.
-- =====================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,        -- citext: Budi@x.id = budi@x.id
  email_verified_at TIMESTAMPTZ,               -- diisi saat OTP pertama berhasil
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  disabled_at   TIMESTAMPTZ,                   -- admin dapat menonaktifkan akun
  CONSTRAINT users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX users_email_idx ON users (email);

-- ---------------------------------------------------------------------
-- Kode OTP. Yang disimpan HANYA hash. Kode asli tidak pernah menyentuh
-- database (aturan T10). Baris disimpan lengkap dengan IP agar rate limit
-- pada aturan S8 dapat dihitung dari satu tabel saja.
-- ---------------------------------------------------------------------
CREATE TABLE auth_otp_codes (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT NOT NULL,
  code_hash     TEXT NOT NULL,                 -- sha256(kode + OTP_PEPPER), hex
  requester_ip  INET,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  consumed_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_otp_email_idx   ON auth_otp_codes (email, created_at DESC);
CREATE INDEX auth_otp_ip_idx      ON auth_otp_codes (requester_ip, created_at DESC);
-- Satu kode aktif per email (aturan S7): indeks parsial menegakkannya di database.
CREATE UNIQUE INDEX auth_otp_one_active_idx
  ON auth_otp_codes (email)
  WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------
-- Sesi. Satu baris per perangkat. Refresh token disimpan sebagai hash dan
-- berotasi setiap dipakai (aturan S10).
-- ---------------------------------------------------------------------
CREATE TABLE auth_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,     -- sha256(token + OTP_PEPPER), hex
  device_label       TEXT,                     -- "Android 14 · Samsung SM-A155F"
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  revoked_reason     TEXT                      -- rotated | signout | reuse_detected | admin
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, created_at DESC);
CREATE INDEX auth_sessions_live_idx ON auth_sessions (expires_at) WHERE revoked_at IS NULL;
```

> ### MENGAPA `auth_otp_codes` MENYIMPAN EMAIL, BUKAN `user_id`
>
> Karena baris OTP dibuat **sebelum** kita tahu apakah pengguna itu ada. Warga baru dan warga lama melewati jalur yang sama persis, dan itulah yang membuat aturan S9 dapat ditegakkan: respons `auth-request-otp` tidak berbeda sedikit pun antara email terdaftar dan tidak, karena pada saat merespons, Edge Function memang belum menyentuh tabel `users`.
>
> Baris `users` baru dibuat di `auth-verify-otp`, setelah kode terbukti benar.

## 6.4 Migrasi 3 — tabel inti (M0 + M1)

`supabase/migrations/20260810000003_core_tables.sql`

```sql
CREATE TYPE user_role AS ENUM (
  'citizen', 'verifier', 'dinas_staff', 'dinas_head', 'emergency_operator', 'admin'
);

CREATE TABLE dinas (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  categories     TEXT[] NOT NULL DEFAULT '{}',
  contact_phone  TEXT,
  contact_email  TEXT,
  head_name      TEXT,
  sla_hours_p0   INT NOT NULL DEFAULT 24,
  sla_hours_p1   INT NOT NULL DEFAULT 72,
  sla_hours_p2   INT NOT NULL DEFAULT 168
);

-- CATATAN v2.0: profiles.id sekarang menunjuk ke public.users, BUKAN auth.users.
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,                     -- opsional, tidak dipakai untuk login
  avatar_url  TEXT,
  role        user_role NOT NULL DEFAULT 'citizen',
  dinas_id    TEXT REFERENCES dinas(id),
  kelurahan   TEXT,
  kecamatan   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_kelurahan_idx ON profiles (kelurahan);

CREATE TABLE complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT,
  description       TEXT NOT NULL,
  category          TEXT,
  assigned_dinas    TEXT REFERENCES dinas(id),
  urgency           TEXT CHECK (urgency IN ('P0','P1','P2')),
  ai_summary        TEXT,
  ai_confidence     REAL CHECK (ai_confidence BETWEEN 0 AND 1),
  location_lat      DOUBLE PRECISION NOT NULL,
  location_lng      DOUBLE PRECISION NOT NULL,
  location_address  TEXT,
  kelurahan         TEXT,
  kecamatan         TEXT,
  status            TEXT NOT NULL DEFAULT 'pending_classification'
                    CHECK (status IN ('pending_classification','pending','verified',
                                      'in_progress','resolved','rejected')),
  rejection_reason  TEXT,
  upvote_count      INT NOT NULL DEFAULT 0,
  image_urls        TEXT[] NOT NULL DEFAULT '{}',
  embedding         VECTOR(384),
  duplicate_of      UUID REFERENCES complaints(id),
  sla_due_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX complaints_geo_idx
  ON complaints USING GIST (ll_to_earth(location_lat, location_lng));
CREATE INDEX complaints_status_idx    ON complaints (status);
CREATE INDEX complaints_dinas_idx     ON complaints (assigned_dinas);
CREATE INDEX complaints_user_idx      ON complaints (user_id, created_at DESC);
CREATE INDEX complaints_kelurahan_idx ON complaints (kelurahan);
CREATE INDEX complaints_embedding_idx
  ON complaints USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE complaint_timeline (
  id           BIGSERIAL PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES profiles(id),
  event_type   TEXT NOT NULL,   -- created | ai_classified | verified | rejected
                                -- | assigned | in_progress | progress_photo
                                -- | resolved | reopened | citizen_comment
  note         TEXT,
  photo_urls   TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX complaint_timeline_complaint_idx
  ON complaint_timeline (complaint_id, created_at DESC);

CREATE TABLE complaint_upvotes (
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (complaint_id, user_id)
);
```

> ### MENGAPA STATUS MEMAKAI `PENDING_CLASSIFICATION` SEBAGAI DEFAULT
>
> Baris disimpan sebelum AI dipanggil. Jika AI gagal atau mati, aduan tetap ada di database dengan status ini dan muncul di antrean klasifikasi manual admin. Tidak ada satu pun jalur di mana aduan warga hilang karena Groq sedang bermasalah.

## 6.5 Migrasi 4 — modul M2 sampai M6

`supabase/migrations/20260810000004_modules.sql`

```sql
-- ===== M3 ANGGARAN (dibuat lebih dulu: direferensikan aspirations) =====
CREATE TABLE budget_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year       INT NOT NULL,
  dinas_id          TEXT REFERENCES dinas(id),
  program_name      TEXT NOT NULL,
  activity_name     TEXT,
  budget_allocated  BIGINT NOT NULL CHECK (budget_allocated >= 0),
  budget_realized   BIGINT NOT NULL DEFAULT 0 CHECK (budget_realized >= 0),
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  location_address  TEXT,
  kelurahan         TEXT,
  kecamatan         TEXT,
  progress_percent  SMALLINT NOT NULL DEFAULT 0
                    CHECK (progress_percent BETWEEN 0 AND 100),
  contractor        TEXT,
  photo_urls        TEXT[] NOT NULL DEFAULT '{}',
  embedding         VECTOR(384),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX budget_items_year_dinas_idx ON budget_items (fiscal_year, dinas_id);
CREATE INDEX budget_items_kelurahan_idx  ON budget_items (kelurahan);
CREATE INDEX budget_items_embedding_idx
  ON budget_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===== M2 ASPIRASI =====
CREATE TABLE voting_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  fiscal_year  INT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (ends_at > starts_at)
);

CREATE TABLE aspirations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  category                TEXT,
  estimated_beneficiaries INT CHECK (estimated_beneficiaries > 0),
  estimated_cost          BIGINT,
  location_lat            DOUBLE PRECISION,
  location_lng            DOUBLE PRECISION,
  kelurahan               TEXT NOT NULL,
  kecamatan               TEXT NOT NULL,
  vote_count              INT NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'voting'
                          CHECK (status IN ('voting','musrenbang','approved',
                                            'budgeted','realized','rejected')),
  musrenbang_rank         INT,
  linked_budget_item_id   UUID REFERENCES budget_items(id),
  voting_period_id        UUID REFERENCES voting_periods(id),
  image_urls              TEXT[] NOT NULL DEFAULT '{}',
  embedding               VECTOR(384),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX aspirations_kelurahan_idx ON aspirations (kelurahan, status);
CREATE INDEX aspirations_period_idx    ON aspirations (voting_period_id, vote_count DESC);

CREATE TABLE aspiration_votes (
  aspiration_id UUID NOT NULL REFERENCES aspirations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aspiration_id, user_id)
);

-- ===== M4 LAYANAN =====
CREATE TABLE service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type      TEXT NOT NULL
                    CHECK (service_type IN ('domisili','sktm','pengantar_nikah',
                                            'izin_keramaian','usaha')),
  form_data         JSONB NOT NULL,
  document_urls     TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','verifying','signing','ready',
                                      'rejected','collected')),
  rejection_reason  TEXT,
  handled_by        UUID REFERENCES profiles(id),
  output_pdf_url    TEXT,
  verification_code TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX service_requests_user_idx   ON service_requests (user_id, created_at DESC);
CREATE INDEX service_requests_status_idx ON service_requests (status);

-- ===== M5 DARURAT =====
CREATE TABLE emergency_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emergency_type   TEXT NOT NULL
                   CHECK (emergency_type IN ('fire','medical','flood','crime','tree','other')),
  location_lat     DOUBLE PRECISION NOT NULL,
  location_lng     DOUBLE PRECISION NOT NULL,
  location_address TEXT,
  audio_url        TEXT,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','responding','resolved','false_alarm')),
  responded_by     UUID REFERENCES profiles(id),
  responded_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX emergency_active_idx ON emergency_alerts (status, created_at DESC);

-- ===== M6 INFO & KOMUNITAS =====
CREATE TABLE point_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points     INT NOT NULL,          -- boleh negatif untuk pembatalan
  reason     TEXT NOT NULL,         -- report_created | report_verified | ...
  ref_table  TEXT,
  ref_id     UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX point_ledger_user_idx ON point_ledger (user_id, created_at DESC);

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  dinas_id     TEXT REFERENCES dinas(id),
  kelurahan    TEXT,                -- NULL berarti berlaku untuk seluruh wilayah
  image_url    TEXT,
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id)
);

CREATE INDEX announcements_published_idx
  ON announcements (published_at DESC) WHERE expires_at IS NULL OR expires_at > NOW();
```

## 6.6 Migrasi 5 — fungsi & trigger

`supabase/migrations/20260810000005_functions.sql`

> **DIHAPUS di v2.0:** trigger `on_auth_user_created` dan fungsi `handle_new_user()`. Keduanya bergantung pada `auth.users` yang tidak lagi dipakai. Penggantinya adalah fungsi `find_or_create_user()` di bawah, yang dipanggil oleh Edge Function `auth-verify-otp` memakai service role.

```sql
-- =====================================================================
-- IDENTITAS
-- =====================================================================

-- Membuat user + profil dalam satu transaksi, atau mengembalikan yang sudah ada.
-- Dipanggil HANYA oleh auth-verify-otp dengan service role key.
CREATE OR REPLACE FUNCTION find_or_create_user(p_email CITEXT)
RETURNS TABLE (user_id UUID, is_new BOOLEAN, is_disabled BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id      UUID;
  v_new     BOOLEAN := FALSE;
  v_disabled TIMESTAMPTZ;
BEGIN
  SELECT id, disabled_at INTO v_id, v_disabled FROM users WHERE email = p_email;

  IF v_id IS NULL THEN
    INSERT INTO users (email, email_verified_at, last_login_at)
    VALUES (p_email, NOW(), NOW())
    RETURNING id INTO v_id;

    -- Profil dibuat bersamaan. full_name sementara diisi 'Warga';
    -- layar onboarding menggantinya. kelurahan sengaja NULL agar
    -- AuthGate mengalihkan ke onboarding (lihat Bagian 8.2).
    INSERT INTO profiles (id, full_name) VALUES (v_id, 'Warga');
    v_new := TRUE;
  ELSE
    UPDATE users SET last_login_at = NOW(), email_verified_at = COALESCE(email_verified_at, NOW())
    WHERE id = v_id;
  END IF;

  RETURN QUERY SELECT v_id, v_new, (v_disabled IS NOT NULL);
END; $$;

-- Membersihkan kode kedaluwarsa dan sesi mati. Dipanggil secara oportunistik
-- di awal auth-request-otp (peluang 1:20) agar tidak butuh pg_cron.
CREATE OR REPLACE FUNCTION purge_expired_auth_rows()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_otp_codes WHERE expires_at < NOW() - INTERVAL '1 day';
  DELETE FROM auth_sessions  WHERE expires_at < NOW() - INTERVAL '7 days';
$$;

-- Rate limit dihitung di database, bukan di memori Edge Function (aturan S8).
CREATE OR REPLACE FUNCTION check_otp_rate_limit(p_email CITEXT, p_ip INET)
RETURNS TABLE (allowed BOOLEAN, reason TEXT, retry_after_seconds INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last     TIMESTAMPTZ;
  v_by_email INT;
  v_by_ip    INT;
BEGIN
  SELECT MAX(created_at) INTO v_last
    FROM auth_otp_codes WHERE email = p_email;

  IF v_last IS NOT NULL AND v_last > NOW() - INTERVAL '60 seconds' THEN
    RETURN QUERY SELECT FALSE, 'cooldown',
      CEIL(EXTRACT(EPOCH FROM (v_last + INTERVAL '60 seconds' - NOW())))::INT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_by_email FROM auth_otp_codes
    WHERE email = p_email AND created_at > NOW() - INTERVAL '1 hour';
  IF v_by_email >= 3 THEN
    RETURN QUERY SELECT FALSE, 'too_many_for_email', 3600; RETURN;
  END IF;

  IF p_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_by_ip FROM auth_otp_codes
      WHERE requester_ip = p_ip AND created_at > NOW() - INTERVAL '1 hour';
    IF v_by_ip >= 10 THEN
      RETURN QUERY SELECT FALSE, 'too_many_for_ip', 3600; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, 0;
END; $$;

-- =====================================================================
-- MODUL M1 sampai M6 — tidak berubah dari v1.0
-- =====================================================================

-- Jaga upvote_count tetap sinkron di level database, bukan di aplikasi.
CREATE OR REPLACE FUNCTION sync_upvote_count() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE complaints SET upvote_count = upvote_count + 1 WHERE id = NEW.complaint_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE complaints SET upvote_count = GREATEST(upvote_count - 1, 0)
      WHERE id = OLD.complaint_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER complaint_upvotes_sync
  AFTER INSERT OR DELETE ON complaint_upvotes
  FOR EACH ROW EXECUTE FUNCTION sync_upvote_count();

CREATE OR REPLACE FUNCTION sync_vote_count() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE aspirations SET vote_count = vote_count + 1 WHERE id = NEW.aspiration_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE aspirations SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.aspiration_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER aspiration_votes_sync
  AFTER INSERT OR DELETE ON aspiration_votes
  FOR EACH ROW EXECUTE FUNCTION sync_vote_count();

-- Catat perubahan status aduan ke timeline secara otomatis.
CREATE OR REPLACE FUNCTION log_complaint_status_change() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO complaint_timeline (complaint_id, actor_id, event_type, note)
    VALUES (NEW.id, auth.uid(), NEW.status,
            CASE WHEN NEW.status = 'rejected' THEN NEW.rejection_reason ELSE NULL END);
  END IF;
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER complaints_status_log
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION log_complaint_status_change();

-- Deteksi duplikat: mirip secara semantik DAN dekat secara geografis.
-- Dua-duanya wajib. Kemiripan teks saja akan menandai lubang jalan
-- di dua kecamatan berbeda sebagai duplikat.
CREATE OR REPLACE FUNCTION find_duplicate_complaints(
  query_embedding      VECTOR(384),
  query_lat            DOUBLE PRECISION,
  query_lng            DOUBLE PRECISION,
  similarity_threshold REAL DEFAULT 0.85,
  radius_meters        INT DEFAULT 500
)
RETURNS TABLE (id UUID, title TEXT, similarity REAL,
               distance_meters DOUBLE PRECISION, upvote_count INT)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.title,
         (1 - (c.embedding <=> query_embedding))::REAL AS similarity,
         earth_distance(ll_to_earth(query_lat, query_lng),
                        ll_to_earth(c.location_lat, c.location_lng)) AS distance_meters,
         c.upvote_count
  FROM complaints c
  WHERE c.embedding IS NOT NULL
    AND c.status NOT IN ('rejected','resolved')
    AND c.duplicate_of IS NULL
    AND earth_box(ll_to_earth(query_lat, query_lng), radius_meters)
        @> ll_to_earth(c.location_lat, c.location_lng)
    AND earth_distance(ll_to_earth(query_lat, query_lng),
                       ll_to_earth(c.location_lat, c.location_lng)) <= radius_meters
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT 5;
$$;

-- Pencarian mata anggaran untuk RAG modul M3.
CREATE OR REPLACE FUNCTION search_budget_items(
  query_embedding VECTOR(384),
  match_count     INT DEFAULT 8,
  filter_year     INT DEFAULT NULL
)
RETURNS TABLE (id UUID, program_name TEXT, activity_name TEXT, dinas_id TEXT,
               budget_allocated BIGINT, budget_realized BIGINT,
               kelurahan TEXT, progress_percent SMALLINT, similarity REAL)
LANGUAGE sql STABLE AS $$
  SELECT b.id, b.program_name, b.activity_name, b.dinas_id,
         b.budget_allocated, b.budget_realized, b.kelurahan, b.progress_percent,
         (1 - (b.embedding <=> query_embedding))::REAL AS similarity
  FROM budget_items b
  WHERE b.embedding IS NOT NULL
    AND (filter_year IS NULL OR b.fiscal_year = filter_year)
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Total poin dan peringkat kelurahan untuk M6.
CREATE OR REPLACE FUNCTION user_total_points(target_user UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(points), 0)::INT FROM point_ledger WHERE user_id = target_user;
$$;

-- CATATAN v2.0: dibuat sebagai MATERIALIZED VIEW, bukan view biasa.
-- Kriteria penerimaan M6 menuntut < 1 detik untuk 50 kelurahan, dan dua
-- LEFT JOIN dengan COUNT DISTINCT tidak akan mencapainya pada data nyata.
CREATE MATERIALIZED VIEW kelurahan_leaderboard AS
  SELECT p.kelurahan,
         p.kecamatan,
         COUNT(DISTINCT p.id)  AS citizen_count,
         COUNT(DISTINCT c.id)  AS report_count,
         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved') AS resolved_count,
         COALESCE(SUM(pl.points), 0) AS total_points
  FROM profiles p
  LEFT JOIN complaints  c  ON c.user_id  = p.id
  LEFT JOIN point_ledger pl ON pl.user_id = p.id
  WHERE p.kelurahan IS NOT NULL
  GROUP BY p.kelurahan, p.kecamatan;

CREATE UNIQUE INDEX kelurahan_leaderboard_idx
  ON kelurahan_leaderboard (kelurahan, kecamatan);

-- Disegarkan setiap 10 menit oleh dashboard admin, atau manual saat demo.
-- CONCURRENTLY memerlukan indeks unik di atas.
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY kelurahan_leaderboard;
$$;
```

## 6.7 Migrasi 6 — Row Level Security

`supabase/migrations/20260810000006_rls.sql`

> ### POLICY MODUL TIDAK BERUBAH SAMA SEKALI DARI v1.0
>
> Ini bukan kebetulan, melainkan alasan utama arsitektur pada Bagian 4.2 dipilih. `auth.uid()` membaca klaim `sub` dari token yang sudah diverifikasi PostgREST; selama Edge Function kita menandatangani token dengan kunci proyek, fungsi itu mengembalikan `users.id` persis seperti dulu ia mengembalikan `auth.users.id`.
>
> Yang bertambah hanyalah policy untuk tiga tabel identitas baru.

```sql
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_otp_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_upvotes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspirations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspiration_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;

-- Fungsi bantu. SECURITY DEFINER agar tidak memicu rekursi policy pada profiles.
CREATE OR REPLACE FUNCTION current_role_name() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_dinas_id() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dinas_id FROM profiles WHERE id = auth.uid();
$$;

-- ---------- users: hanya pemilik, dan hanya baca ----------
CREATE POLICY users_self_read ON users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY users_admin_read ON users FOR SELECT
  USING (current_role_name() = 'admin');
-- Tidak ada policy INSERT/UPDATE/DELETE. Baris users hanya ditulis oleh
-- find_or_create_user() lewat service role key di dalam Edge Function.

-- ---------- auth_otp_codes: TIDAK ADA POLICY SAMA SEKALI ----------
-- RLS aktif tanpa policy = tidak ada satu pun klien yang dapat menyentuhnya,
-- termasuk untuk membaca. Ini disengaja (aturan T4). Hanya service role
-- yang boleh, dan itu hanya terjadi di dalam Edge Function auth-*.

-- ---------- auth_sessions: pemilik boleh melihat & mencabut perangkatnya ----------
CREATE POLICY sessions_self_read ON auth_sessions FOR SELECT
  USING (user_id = auth.uid());
-- Pencabutan dilakukan lewat Edge Function auth-signout, bukan UPDATE langsung,
-- agar rotasi & alasan pencabutan tercatat konsisten.

-- ---------- dinas ----------
CREATE POLICY dinas_read ON dinas FOR SELECT USING (true);
CREATE POLICY dinas_admin_write ON dinas FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- profiles ----------
CREATE POLICY profiles_read ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = current_role_name());  -- role terkunci
CREATE POLICY profiles_admin_all ON profiles FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- complaints ----------
CREATE POLICY complaints_read ON complaints FOR SELECT USING (true);
CREATE POLICY complaints_insert_own ON complaints FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY complaints_owner_update ON complaints FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('pending_classification','pending'))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY complaints_verifier_update ON complaints FOR UPDATE
  USING (current_role_name() IN ('verifier','admin'))
  WITH CHECK (current_role_name() IN ('verifier','admin'));
CREATE POLICY complaints_dinas_update ON complaints FOR UPDATE
  USING (current_role_name() IN ('dinas_staff','dinas_head')
         AND assigned_dinas = current_dinas_id())
  WITH CHECK (current_role_name() IN ('dinas_staff','dinas_head')
         AND assigned_dinas = current_dinas_id());

-- ---------- complaint_timeline ----------
CREATE POLICY timeline_read ON complaint_timeline FOR SELECT USING (true);
CREATE POLICY timeline_insert ON complaint_timeline FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND ( current_role_name() IN ('verifier','dinas_staff','dinas_head','admin')
          OR EXISTS (SELECT 1 FROM complaints c
                     WHERE c.id = complaint_id AND c.user_id = auth.uid()) )
  );

-- ---------- upvotes: satu warga satu suara ----------
CREATE POLICY upvotes_read ON complaint_upvotes FOR SELECT USING (true);
CREATE POLICY upvotes_insert_own ON complaint_upvotes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY upvotes_delete_own ON complaint_upvotes FOR DELETE
  USING (user_id = auth.uid());

-- ---------- aspirations ----------
CREATE POLICY aspirations_read ON aspirations FOR SELECT USING (true);
CREATE POLICY aspirations_insert_own ON aspirations FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY aspirations_owner_update ON aspirations FOR UPDATE
  USING (user_id = auth.uid() AND status = 'voting')
  WITH CHECK (user_id = auth.uid());
CREATE POLICY aspirations_admin_update ON aspirations FOR UPDATE
  USING (current_role_name() IN ('admin','dinas_head'))
  WITH CHECK (current_role_name() IN ('admin','dinas_head'));

-- Memilih hanya boleh untuk aspirasi di kelurahan sendiri dan periode aktif.
CREATE POLICY votes_read ON aspiration_votes FOR SELECT USING (true);
CREATE POLICY votes_insert_own ON aspiration_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM aspirations a
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN voting_periods vp ON vp.id = a.voting_period_id
      WHERE a.id = aspiration_id
        AND a.kelurahan = p.kelurahan
        AND a.status = 'voting'
        AND (vp.id IS NULL OR (vp.is_active AND NOW() BETWEEN vp.starts_at AND vp.ends_at))
    )
  );
CREATE POLICY votes_delete_own ON aspiration_votes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY periods_read ON voting_periods FOR SELECT USING (true);
CREATE POLICY periods_admin ON voting_periods FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- budget: transparansi penuh, tulis hanya admin ----------
CREATE POLICY budget_read ON budget_items FOR SELECT USING (true);
CREATE POLICY budget_admin_write ON budget_items FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- service_requests: PRIVAT, hanya pemilik dan petugas ----------
CREATE POLICY service_owner_read ON service_requests FOR SELECT
  USING (user_id = auth.uid()
         OR current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'));
CREATE POLICY service_insert_own ON service_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY service_staff_update ON service_requests FOR UPDATE
  USING (current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'))
  WITH CHECK (current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'));

-- ---------- emergency: pelapor + operator ----------
CREATE POLICY emergency_read ON emergency_alerts FOR SELECT
  USING (user_id = auth.uid()
         OR current_role_name() IN ('emergency_operator','admin'));
CREATE POLICY emergency_insert_own ON emergency_alerts FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY emergency_operator_update ON emergency_alerts FOR UPDATE
  USING (current_role_name() IN ('emergency_operator','admin'))
  WITH CHECK (current_role_name() IN ('emergency_operator','admin'));

-- ---------- point_ledger: baca publik untuk leaderboard, tulis hanya server ----------
CREATE POLICY points_read ON point_ledger FOR SELECT USING (true);
-- Tidak ada policy INSERT/UPDATE/DELETE. Poin hanya ditulis oleh
-- Edge Function memakai service role key, yang melewati RLS.

-- ---------- announcements ----------
CREATE POLICY announcements_read ON announcements FOR SELECT USING (true);
CREATE POLICY announcements_staff_write ON announcements FOR ALL
  USING (current_role_name() IN ('admin','dinas_head'))
  WITH CHECK (current_role_name() IN ('admin','dinas_head'));
```

> ### VERIFIKASI RLS — WAJIB DIJALANKAN
>
> ```bash
> supabase db reset
> psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c \
>   "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';"
> ```
>
> Setiap baris harus menampilkan `rowsecurity = t`. Satu pun yang bernilai `f` berarti ada tabel terbuka tanpa perlindungan. **Perhatikan khusus `auth_otp_codes`:** ia harus `t` dan sekaligus tidak punya policy apa pun — periksa dengan `SELECT * FROM pg_policies WHERE tablename = 'auth_otp_codes';` yang harus mengembalikan nol baris.

## 6.8 Migrasi 7 — storage

`supabase/migrations/20260810000007_storage.sql`

```sql
-- Bucket publik: foto aduan, foto progres, foto aspirasi.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('complaint-photos', 'complaint-photos', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('progress-photos',  'progress-photos',  true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('aspiration-photos','aspiration-photos',true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Bucket PRIVAT: dokumen identitas dan audio darurat.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('service-docs',    'service-docs',    false, 10485760,
   ARRAY['image/jpeg','image/png','application/pdf']),
  ('emergency-audio', 'emergency-audio', false, 5242880,
   ARRAY['audio/m4a','audio/mpeg','audio/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "foto publik dapat dibaca siapa pun"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('complaint-photos','progress-photos','aspiration-photos'));

CREATE POLICY "warga unggah ke foldernya sendiri"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('complaint-photos','aspiration-photos','service-docs','emergency-audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pemilik membaca dokumen privatnya"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('service-docs','emergency-audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "petugas mengunggah foto progres"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND current_role_name() IN ('dinas_staff','dinas_head','verifier','admin')
  );
```

Konvensi penamaan berkas: `{user_id}/{uuid}.{ext}` untuk unggahan warga, `{complaint_id}/{uuid}.{ext}` untuk foto progres petugas.

> **Catatan v2.0:** Storage API memverifikasi JWT dengan kunci yang sama dengan PostgREST, sehingga `auth.uid()` di dalam policy storage juga berfungsi dengan token buatan kita. Task 1.8 mewajibkan pengujian unggah nyata sebagai bukti — jangan diasumsikan.

## 6.9 Seed data

`supabase/seed.sql`

```sql
INSERT INTO dinas (id, name, categories, sla_hours_p0, sla_hours_p1, sla_hours_p2) VALUES
  ('pupr',     'Dinas Pekerjaan Umum & Penataan Ruang',
   ARRAY['jalan_rusak','jembatan','drainase','trotoar'],           24, 72, 168),
  ('dlh',      'Dinas Lingkungan Hidup',
   ARRAY['sampah','pencemaran','pohon_tumbang','taman_kota'],      12, 48, 168),
  ('dishub',   'Dinas Perhubungan',
   ARRAY['lampu_lalu_lintas','rambu','parkir_liar','angkutan_umum'],12, 48, 168),
  ('dinkes',   'Dinas Kesehatan',
   ARRAY['fasilitas_kesehatan','wabah_penyakit','sanitasi'],        6, 24, 120),
  ('disdik',   'Dinas Pendidikan',
   ARRAY['fasilitas_sekolah','layanan_pendidikan'],                24, 72, 168),
  ('satpolpp', 'Satuan Polisi Pamong Praja',
   ARRAY['ketertiban_umum','pkl_liar','reklame_liar'],              6, 24, 120),
  ('pdam',     'Perusahaan Daerah Air Minum',
   ARRAY['air_bersih','pipa_bocor'],                               12, 48, 168),
  ('lainnya',  'Belum Terklasifikasi',
   ARRAY['lainnya'],                                               24, 72, 168)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Pengguna demo. Hanya untuk lingkungan lokal.
-- Karena SIGAP tidak memakai Supabase Auth, seed dapat membuat pengguna
-- secara langsung — tidak perlu memanggil API auth apa pun.
-- ---------------------------------------------------------------------
INSERT INTO users (id, email, email_verified_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'warga@sigap.test',    NOW()),
  ('22222222-2222-2222-2222-222222222222', 'verifier@sigap.test', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'pupr@sigap.test',     NOW()),
  ('44444444-4444-4444-4444-444444444444', 'operator@sigap.test', NOW()),
  ('55555555-5555-5555-5555-555555555555', 'admin@sigap.test',    NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sri Wahyuni',  'citizen',            NULL,   'Sukamaju', 'Cibeunying'),
  ('22222222-2222-2222-2222-222222222222', 'Wulan Sari',   'verifier',           NULL,   'Sukamaju', 'Cibeunying'),
  ('33333333-3333-3333-3333-333333333333', 'Deni Kurnia',  'dinas_staff',        'pupr', 'Sukamaju', 'Cibeunying'),
  ('44444444-4444-4444-4444-444444444444', 'Operator Piket','emergency_operator', NULL,  'Sukamaju', 'Cibeunying'),
  ('55555555-5555-5555-5555-555555555555', 'Admin SIGAP',  'admin',              NULL,   'Sukamaju', 'Cibeunying')
ON CONFLICT (id) DO NOTHING;
```

> ### KONSISTENSI KATALOG DINAS
>
> Daftar dinas muncul di dua tempat: `supabase/seed.sql` dan `packages/shared/src/constants.ts`. Keduanya wajib identik. Jika Anda menambah dinas atau kategori, ubah kedua berkas dalam commit yang sama. Test `schemas.test.ts` akan menangkap ketidakcocokan kategori duplikat, tetapi tidak dapat menangkap dinas yang hilang di salah satu berkas.

## 6.10 Aturan poin (M6)

| Kejadian | `reason` | Poin | Catatan |
|---|---|---|---|
| Mengirim aduan | `report_created` | **+10** | Diberikan saat baris tersimpan, sebelum AI selesai |
| Aduan terverifikasi | `report_verified` | **+25** | Diberikan oleh verifier |
| Aduan selesai ditangani | `report_resolved` | **+50** | Diberikan saat status menjadi `resolved` |
| Mendukung laporan | `upvote_given` | **+2** | Maksimal 20 poin per hari agar tidak diakali |
| Usulan lolos Musrenbang | `aspiration_musrenbang` | **+100** | Penghargaan tertinggi dalam sistem |
| Aduan terbukti palsu | `report_false` | **−35** | Membatalkan +10 dan +25 yang telah diberikan |

Lencana dihitung dari total poin: **Warga Peduli** (100), **Penjaga Lingkungan** (500), **Penggerak Kelurahan** (1.500), **Pahlawan Kota** (5.000).
---

# 7 · Lapisan AI, Auth & Edge Function

## 7.1 Peta fungsi

| Fungsi | Model / layanan | Edge Function | Jalur kegagalan |
|---|---|---|---|
| **Kirim kode masuk** | Resend | `auth-request-otp` | Kode dibatalkan, warga diberi tahu email gagal terkirim, dipersilakan coba lagi |
| **Verifikasi kode & buat sesi** | — | `auth-verify-otp` | Tidak ada sesi yang dibuat. Pesan generik (aturan S9) |
| **Perpanjang sesi** | — | `auth-refresh` | Warga diarahkan ke layar masuk, draf aduan disimpan lebih dulu |
| **Keluar** | — | `auth-signout` | Token lokal tetap dihapus meskipun panggilan gagal |
| Klasifikasi dinas, urgensi, judul, ringkasan | `llama-3.3-70b-versatile` | `classify-report` | Status tetap `pending_classification`, masuk antrean manual admin |
| Embedding untuk duplikat & RAG | `gte-small` (384 dimensi) | `embed-text` | Kolom `embedding` dibiarkan NULL, deteksi duplikat dilewati |
| Draf jawaban resmi dinas | `llama-3.3-70b-versatile` | `draft-response` | Petugas menulis manual |
| Tanya-jawab anggaran (RAG) | Llama + pgvector | `ask-budget` | Pesan "Layanan tanya anggaran sedang sibuk, coba lagi sebentar lagi" |
| OCR KTP/KK | `gemini-2.0-flash` vision | `ocr-doc` | Warga mengisi form manual |
| Penyiaran darurat | Tanpa AI | `dispatch-emergency` | Tidak boleh gagal — tidak bergantung pada AI mana pun |

> ### CATATAN MODEL EMBEDDING
>
> v1.0 menyebut `all-MiniLM-L6-v2` tanpa menyebut penyedianya, padahal Groq tidak menyediakan endpoint embedding. Yang dipakai adalah **`gte-small` yang berjalan di dalam Edge Function Supabase** lewat `Supabase.ai.Session('gte-small')`. Model ini juga menghasilkan **384 dimensi**, sehingga kolom `VECTOR(384)` dan seluruh indeks ivfflat tidak berubah.
>
> Keuntungan lain: embedding tidak keluar dari infrastruktur Supabase, tidak memakan kuota Groq, dan tidak menambah satu pun secret.

## 7.2 Kontrak API Edge Function

Semua Edge Function memakai kontrak yang sama: metode `POST`, body JSON, respons JSON. Kode status **200 dengan `{ "ok": false, "reason": "..." }`** dipakai untuk kegagalan yang diharapkan (AI tidak tersedia, kode salah); kode 4xx/5xx hanya untuk kesalahan sesungguhnya.

Fungsi AI dan `auth-signout` mewajibkan header `Authorization: Bearer <access token>`. Fungsi `auth-request-otp`, `auth-verify-otp`, dan `auth-refresh` bersifat publik — mereka justru yang menerbitkan token — dan karena itu wajib memiliki rate limit sendiri (aturan S8).

| Endpoint | Auth | Request | Response sukses |
|---|---|---|---|
| `POST /auth-request-otp` | publik | `{ email: string }` | `{ ok: true, cooldownSeconds: 60 }` |
| `POST /auth-verify-otp` | publik | `{ email: string, code: string, deviceLabel?: string }` | `{ ok: true, accessToken, refreshToken, expiresIn: 3600, isNewUser: boolean }` |
| `POST /auth-refresh` | publik | `{ refreshToken: string }` | `{ ok: true, accessToken, refreshToken, expiresIn: 3600 }` |
| `POST /auth-signout` | wajib | `{ refreshToken: string, allDevices?: boolean }` | `{ ok: true }` |
| `POST /classify-report` | wajib | `{ complaintId: string }` | `{ ok: true, classification: {...}, duplicates: [...] }` |
| `POST /embed-text` | wajib | `{ text: string, target: 'complaint'\|'aspiration'\|'budget', id: string }` | `{ ok: true, dimensions: 384 }` |
| `POST /draft-response` | wajib | `{ complaintId: string }` | `{ ok: true, draft: string }` |
| `POST /ask-budget` | wajib | `{ question: string, fiscalYear?: number, kelurahan?: string }` | `{ ok: true, answer: string, sources: BudgetItem[] }` |
| `POST /ocr-doc` | wajib | `{ documentUrl: string, docType: 'ktp'\|'kk' }` | `{ ok: true, fields: {...}, confidence: number }` |
| `POST /dispatch-emergency` | wajib | `{ alertId: string }` | `{ ok: true, notifiedOperators: number }` |

**Nilai `reason` yang dikenali klien:**

| `reason` | Arti | Yang dilakukan aplikasi |
|---|---|---|
| `ai_unavailable` | Groq/Gemini gagal atau timeout | Tampilkan pesan tenang, data tetap tersimpan |
| `invalid_code` | Kode OTP salah, kedaluwarsa, atau tidak ada | "Kode salah atau sudah kedaluwarsa. Coba kirim ulang." |
| `too_many_attempts` | Lima percobaan salah habis | Minta kirim ulang kode baru |
| `rate_limited` | Melewati batas S8 | Tampilkan `retryAfterSeconds` sebagai hitung mundur |
| `email_failed` | Resend menolak atau timeout | "Gagal mengirim email. Periksa alamatnya lalu coba lagi." |
| `session_expired` | Refresh token kedaluwarsa/dicabut | Bersihkan sesi, alihkan ke masuk, simpan draf |
| `account_disabled` | `users.disabled_at` terisi | "Akun ini dinonaktifkan. Hubungi kelurahan." |

## 7.3 Klien bersama

### `_shared/groq.ts`

```ts
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 1;

export interface GroqOptions {
  model?: string; timeoutMs?: number; maxRetries?: number; temperature?: number;
}

export async function callGroq(prompt: string, opts: GroqOptions = {}): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY belum diset di Edge Function secrets');

  const model      = opts.model      ?? DEFAULT_MODEL;
  const timeoutMs  = opts.timeoutMs  ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  let lastError = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: opts.temperature ?? 0.2,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) { lastError = `HTTP ${res.status}: ${await res.text()}`; continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        lastError = 'Respons Groq tidak memuat message.content'; continue;
      }
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Groq gagal setelah ${maxRetries + 1} percobaan: ${lastError}`);
}
```

### `_shared/resend.ts` — BARU di v2.0

Bentuknya sengaja dibuat kembar dengan `groq.ts`: timeout, satu retry, dan lemparan error yang deskriptif. Tidak memakai SDK.

```ts
const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 1;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;       // WAJIB. Sebagian klien email warga tidak merender HTML.
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult { id: string }

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from   = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey) throw new Error('RESEND_API_KEY belum diset di Edge Function secrets');
  if (!from)   throw new Error('RESEND_FROM_EMAIL belum diset di Edge Function secrets');

  let lastError = '';
  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          tags: input.tags,
        }),
      });

      // 4xx adalah kesalahan kita (alamat tidak valid, domain belum terverifikasi).
      // Mengulanginya tidak akan menolong, jadi berhenti di sini.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`Resend menolak permintaan (HTTP ${res.status}): ${await res.text()}`);
      }
      if (!res.ok) { lastError = `HTTP ${res.status}: ${await res.text()}`; continue; }

      const data = await res.json();
      if (typeof data?.id !== 'string') { lastError = 'Respons Resend tanpa id'; continue; }
      return { id: data.id };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Resend menolak')) throw err;
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Resend gagal setelah ${DEFAULT_MAX_RETRIES + 1} percobaan: ${lastError}`);
}
```

### `_shared/otp.ts` — BARU di v2.0

```ts
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';

export const OTP_LENGTH        = 6;
export const OTP_TTL_MINUTES   = 10;
export const OTP_MAX_ATTEMPTS  = 5;
export const OTP_COOLDOWN_SEC  = 60;

/** Enam digit acak dari CSPRNG. Math.random() dilarang di sini. */
export function generateOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  // Modulo 1_000_000 lalu padStart: 000000 sampai 999999, distribusi cukup rata
  // karena 2^32 jauh lebih besar daripada 10^6.
  return String(bytes[0] % 1_000_000).padStart(OTP_LENGTH, '0');
}

/** Hash kode dengan pepper dari secrets. Kode asli tidak pernah disimpan (T10). */
export async function hashOtp(code: string): Promise<string> {
  const pepper = Deno.env.get('OTP_PEPPER');
  if (!pepper) throw new Error('OTP_PEPPER belum diset di Edge Function secrets');
  const data = new TextEncoder().encode(`${code}:${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return encodeHex(new Uint8Array(digest));
}

/** Perbandingan waktu-tetap. Perbandingan `===` biasa membocorkan lewat timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Normalisasi email: trim + lowercase. Kolom CITEXT sudah tahan kapital,
 *  tetapi rate limit dan perbandingan di kode tetap butuh bentuk baku. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Refresh token: 32 byte acak, hex. Bukan JWT — tidak perlu isi apa pun. */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeHex(bytes);
}
```

### `_shared/jwt.ts` — BARU di v2.0

```ts
import { create, verify, type Header, type Payload }
  from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

export const ACCESS_TOKEN_TTL_SECONDS  = 3600;            // 1 jam  (T9)
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari (T9)

let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = Deno.env.get('SUPABASE_JWT_SECRET');
  if (!secret) throw new Error('SUPABASE_JWT_SECRET belum diset di Edge Function secrets');
  cachedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return cachedKey;
}

/**
 * Menerbitkan access token yang akan diterima PostgREST, Storage, dan Realtime.
 * Klaim `role` WAJIB 'authenticated' — itu peran Postgres, bukan peran SIGAP
 * (aturan S12). Peran SIGAP dibaca dari profiles oleh current_role_name().
 */
export async function signAccessToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header: Header = { alg: 'HS256', typ: 'JWT' };

  // Proyek dengan signing key asimetris memerlukan kid (lihat Bagian 4.2).
  const kid = Deno.env.get('SUPABASE_JWT_KID');
  if (kid) (header as Record<string, unknown>).kid = kid;

  const payload: Payload = {
    sub:  userId,
    role: 'authenticated',
    aud:  'authenticated',
    iat:  now,
    exp:  now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return await create(header, payload, await getSigningKey());
}

/** Dipakai Edge Function yang mewajibkan Authorization untuk mengenali pemanggil. */
export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
  const payload = await verify(token, await getSigningKey());
  const sub = payload.sub;
  if (typeof sub !== 'string') throw new Error('Token tanpa klaim sub');
  return { userId: sub };
}

/** Helper untuk seluruh Edge Function yang butuh identitas pemanggil. */
export async function requireUser(req: Request): Promise<string> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('unauthorized');
  const { userId } = await verifyAccessToken(header.slice(7));
  return userId;
}
```

> ### MENGAPA REFRESH TOKEN BUKAN JWT
>
> JWT dirancang agar dapat diverifikasi tanpa menyentuh database — sifat yang justru berbahaya untuk refresh token, karena token yang sudah dicabut tetap akan lolos verifikasi sampai kedaluwarsa. Refresh token SIGAP adalah 32 byte acak yang **wajib** dicari di tabel `auth_sessions`, sehingga pencabutan berlaku seketika (aturan S10).

## 7.4 Template prompt

`supabase/functions/_shared/prompts.ts`

### Prompt klasifikasi aduan

```ts
export interface DinasSummary { id: string; name: string; categories: string[] }

export function buildClassificationPrompt(
  description: string,
  dinasList: DinasSummary[],
): string {
  const katalog = dinasList
    .map((d) => `- ${d.id} (${d.name}) menangani: ${d.categories.join(', ')}`)
    .join('\n');

  return `Anda adalah petugas triase aduan masyarakat di pemerintah daerah Indonesia.

Katalog dinas dan kategori yang tersedia:
${katalog}

Aturan tingkat urgensi:
- P0: ada ancaman nyawa, kebakaran, banjir aktif, bangunan roboh, wabah,
      atau kabel listrik putus.
- P1: berpotensi mencederai orang atau mengganggu layanan penting dalam waktu dekat.
- P2: mengganggu kenyamanan tetapi tidak membahayakan.

Aduan warga:
"""
${description}
"""

Jawab HANYA dengan objek JSON, tanpa penjelasan tambahan, dengan bentuk persis:
{
  "title": "judul ringkas maksimal 12 kata",
  "category": "salah satu kategori dari katalog di atas",
  "assignedDinas": "salah satu id dinas dari katalog di atas",
  "urgency": "P0 atau P1 atau P2",
  "summary": "ringkasan satu sampai dua kalimat untuk petugas",
  "confidence": 0.0 sampai 1.0
}

Jika aduan tidak jelas atau tidak cocok dengan kategori mana pun, gunakan
assignedDinas "lainnya", category "lainnya", dan confidence di bawah 0.5.`;
}
```

### Prompt draf jawaban dinas

```ts
export function buildDraftResponsePrompt(input: {
  title: string; description: string; dinasName: string;
  status: string; timelineNotes: string[];
}): string {
  return `Anda menulis jawaban resmi ${input.dinasName} kepada warga pelapor.

Aduan: ${input.title}
Isi: ${input.description}
Status saat ini: ${input.status}
Catatan penanganan: ${input.timelineNotes.join(' | ') || 'belum ada'}

Tulis jawaban dalam bahasa Indonesia yang sopan tetapi tidak birokratis.
Aturan:
- Maksimal 4 kalimat.
- Sebut tindakan konkret yang sudah atau akan dilakukan.
- Jangan berjanji tanggal yang tidak ada di catatan penanganan.
- Jangan memakai kata: disposisi, dimaksud, adapun, sehubungan dengan.

Jawab HANYA dengan objek JSON: { "draft": "isi jawaban" }`;
}
```

### Prompt RAG anggaran

```ts
export function buildBudgetAnswerPrompt(
  question: string,
  items: Array<{ program_name: string; activity_name: string | null; dinas_id: string;
                 budget_allocated: number; budget_realized: number;
                 kelurahan: string | null; progress_percent: number }>,
): string {
  const konteks = items.map((b, i) =>
    `[${i + 1}] ${b.program_name}${b.activity_name ? ' — ' + b.activity_name : ''}
     Dinas: ${b.dinas_id} | Lokasi: ${b.kelurahan ?? 'seluruh wilayah'}
     Pagu: Rp ${b.budget_allocated.toLocaleString('id-ID')}
     Realisasi: Rp ${b.budget_realized.toLocaleString('id-ID')} (${b.progress_percent}%)`
  ).join('\n\n');

  return `Anda menjawab pertanyaan warga tentang APBD berdasarkan data resmi berikut.

DATA ANGGARAN:
${konteks}

PERTANYAAN WARGA: ${question}

Aturan menjawab:
- Jawab HANYA berdasarkan data di atas. Jangan mengarang angka.
- Bila data tidak memuat jawabannya, katakan terus terang bahwa datanya
  tidak tersedia dan sarankan warga menghubungi dinas terkait.
- Sebutkan angka rupiah lengkap dengan pemisah ribuan.
- Rujuk sumber dengan nomor dalam kurung siku, contoh: [1].
- Maksimal 5 kalimat.

Jawab HANYA dengan objek JSON:
{ "answer": "jawaban Anda", "sourceIndexes": [1, 2] }`;
}
```

### Template email — BARU di v2.0

`supabase/functions/_shared/email-templates.ts`

Aturan 2.3 berlaku penuh di sini: isi email berbahasa Indonesia, nada manusia, tanpa kata birokrasi. Email OTP wajib punya versi teks biasa — sebagian warga membuka email di aplikasi bawaan yang memblokir HTML.

```ts
export function otpEmail(code: string): { subject: string; html: string; text: string } {
  const subject = `${code} — kode masuk SIGAP`;

  const text = [
    `Kode masuk Anda: ${code}`,
    '',
    'Masukkan kode ini di aplikasi SIGAP. Kode berlaku 10 menit.',
    '',
    'Kalau Anda tidak sedang mencoba masuk, abaikan saja email ini.',
    'Tidak ada yang bisa masuk ke akun Anda tanpa kode di atas.',
    '',
    'SIGAP — Sistem Informasi Gerakan Aspirasi & Pelayanan',
  ].join('\n');

  // Inline style, tabel, tanpa CSS eksternal — aturan main klien email.
  const html = `<!doctype html>
<html lang="id"><body style="margin:0;padding:24px;background:#F8FAFC;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;
             border:1px solid #E2E8F0;border-radius:12px;padding:32px">
        <tr><td style="font-size:18px;font-weight:600;color:#0F4C5C;padding-bottom:16px">
          SIGAP
        </td></tr>
        <tr><td style="font-size:16px;line-height:24px;padding-bottom:24px">
          Masukkan kode ini di aplikasi untuk masuk.
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px">
          <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0F4C5C;
                      background:#E6F2F5;border-radius:8px;padding:16px 8px">${code}</div>
        </td></tr>
        <tr><td style="font-size:14px;line-height:20px;color:#475569">
          Kode berlaku 10 menit. Kalau Anda tidak sedang mencoba masuk,
          abaikan saja email ini — tidak ada yang bisa masuk tanpa kode di atas.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
```

> ### KODE OTP DI BARIS SUBJEK
>
> Menaruh kode di depan subjek (`123456 — kode masuk SIGAP`) bukan gaya-gayaan: banyak klien email menampilkan subjek di notifikasi kunci layar, sehingga Bu Sri dapat membaca kodenya **tanpa membuka aplikasi email sama sekali**. Ini mitigasi paling murah untuk gesekan persona di Bagian 3.1.

## 7.5 Alur classify-report secara lengkap

```
1. Verifikasi header Authorization lewat requireUser() → 401 bila tidak valid
2. Baca body { complaintId }                           → 400 bila kosong
3. Ambil baris complaints via service role             → 404 bila tidak ada
4. Pastikan complaint.user_id === userId               → 403 bila bukan miliknya
5. Ambil katalog dinas dari tabel dinas
6. Panggil callGroq(buildClassificationPrompt(...))
   ├─ gagal  → return 200 { ok:false, reason:'ai_unavailable' }
   │           baris TETAP berstatus pending_classification
   └─ sukses → parseClassification(raw, dinasList)
7. Hitung embedding lewat embed-text, simpan ke kolom embedding
   └─ gagal → lanjutkan tanpa embedding (deteksi duplikat dilewati)
8. Panggil find_duplicate_complaints(embedding, lat, lng)
9. Hitung sla_due_at = NOW() + sla_hours[urgency] dari dinas terpilih
10. UPDATE complaints: title, category, assigned_dinas, urgency,
    ai_summary, ai_confidence, sla_due_at, status='pending'
11. INSERT complaint_timeline: event_type='ai_classified'
12. INSERT point_ledger: +10 report_created (bila belum ada)
13. return 200 { ok:true, classification, duplicates }
```

### Fungsi parsing & SLA — wajib diekspor agar dapat diuji

```ts
/** Membersihkan pembungkus markdown lalu memvalidasi hasil model. */
export function parseClassification(raw: string, dinasList: DinasRow[]): Classification {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error(`Respons AI bukan JSON valid: ${cleaned.slice(0, 200)}`); }

  const o = parsed as Record<string, unknown>;

  const dinas = dinasList.find((d) => d.id === o.assignedDinas);
  if (!dinas) throw new Error(`assignedDinas "${String(o.assignedDinas)}" tidak ada di katalog`);

  if (!['P0','P1','P2'].includes(String(o.urgency)))
    throw new Error(`urgency "${String(o.urgency)}" tidak valid`);

  if (typeof o.title !== 'string' || o.title.length < 5)
    throw new Error('title tidak valid');

  if (typeof o.summary !== 'string' || o.summary.length < 10)
    throw new Error('summary tidak valid');

  const confidence = Number(o.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new Error('confidence harus antara 0 dan 1');

  // Bila model mengarang kategori, jatuhkan ke kategori pertama milik dinas itu.
  const category = dinas.categories.includes(String(o.category))
    ? String(o.category) : dinas.categories[0];

  return {
    title: o.title.slice(0, 120),
    category,
    assignedDinas: dinas.id,
    urgency: o.urgency as Classification['urgency'],
    summary: o.summary.slice(0, 500),
    confidence,
  };
}

export function computeSlaDueAt(
  from: Date, urgency: Classification['urgency'], dinas: DinasRow,
): Date {
  const hours = urgency === 'P0' ? dinas.slaHoursP0
              : urgency === 'P1' ? dinas.slaHoursP1
              :                    dinas.slaHoursP2;
  return new Date(from.getTime() + hours * 3600_000);
}
```

## 7.6 Sistem autentikasi — BARU di v2.0

**Baca bagian ini sebelum menyentuh Bagian 9.1.** Empat Edge Function di bawah menggantikan seluruh peran Supabase Auth.

### `auth-request-otp`

```
1. Baca body { email }                          → 400 bila kosong
2. email = normalizeEmail(email)
   └─ tidak lolos regex → 200 { ok:false, reason:'invalid_email' }
3. Ambil IP dari header x-forwarded-for
4. Peluang 1:20, panggil purge_expired_auth_rows()   (pembersihan oportunistik)
5. check_otp_rate_limit(email, ip)
   └─ tidak lolos → 200 { ok:false, reason:'rate_limited', retryAfterSeconds }
6. Batalkan kode aktif sebelumnya:
   UPDATE auth_otp_codes SET consumed_at = NOW()
    WHERE email = :email AND consumed_at IS NULL
   (wajib dilakukan sebelum INSERT — ada indeks unik parsial di 6.3)
7. code = generateOtp(); hash = await hashOtp(code)
8. INSERT auth_otp_codes (email, code_hash, requester_ip,
                          expires_at = NOW() + 10 menit)
9. sendEmail(otpEmail(code))
   ├─ gagal → UPDATE auth_otp_codes SET consumed_at = NOW() WHERE id = :id   (T11)
   │          return 200 { ok:false, reason:'email_failed' }
   └─ sukses
10. return 200 { ok:true, cooldownSeconds: 60 }

CATATAN: langkah 6–10 TIDAK PERNAH menyentuh tabel users. Inilah yang
membuat respons identik untuk email terdaftar dan tidak (aturan S9).
```

> ### MODE PENGEMBANGAN LOKAL
>
> Supabase Auth punya `[auth.sms.test_otp]` di `config.toml`. Karena kita tidak memakainya, penggantinya adalah variabel `OTP_DEV_MODE`:
>
> ```ts
> // Hanya di dalam auth-request-otp, tepat sebelum sendEmail:
> if (Deno.env.get('OTP_DEV_MODE') === 'true') {
>   console.log(`[DEV] OTP untuk ${email}: ${code}`);
>   return json({ ok: true, cooldownSeconds: 60, devCode: code });
> }
> ```
>
> **`OTP_DEV_MODE` hanya boleh ada di `supabase/.env.local`.** Sebelum deploy, jalankan `supabase secrets list` dan pastikan variabel itu tidak ada di proyek remote. Task 1.9 mewajibkan pemeriksaan ini, dan `auth-request-otp` wajib punya test yang membuktikan `devCode` tidak pernah muncul saat `OTP_DEV_MODE` tidak diset.

### `auth-verify-otp`

```
1. Baca body { email, code, deviceLabel? }      → 400 bila kosong
2. email = normalizeEmail(email)
3. Ambil kode aktif:
   SELECT * FROM auth_otp_codes
    WHERE email = :email AND consumed_at IS NULL AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
   └─ tidak ada → 200 { ok:false, reason:'invalid_code' }
4. Bila attempts >= 5 → 200 { ok:false, reason:'too_many_attempts' }
5. Cocokkan: timingSafeEqual(row.code_hash, await hashOtp(code))
   └─ tidak cocok → UPDATE attempts = attempts + 1
                  → 200 { ok:false, reason:'invalid_code' }
6. UPDATE auth_otp_codes SET consumed_at = NOW() WHERE id = row.id
7. find_or_create_user(email) → { user_id, is_new, is_disabled }
   └─ is_disabled → 200 { ok:false, reason:'account_disabled' }
8. refreshToken = generateRefreshToken()
   INSERT auth_sessions (user_id, refresh_token_hash = sha256(token+pepper),
                         device_label, expires_at = NOW() + 30 hari)
9. accessToken = await signAccessToken(user_id)
10. return 200 { ok:true, accessToken, refreshToken,
                 expiresIn: 3600, isNewUser: is_new }
```

### `auth-refresh`

```
1. Baca body { refreshToken }                   → 400 bila kosong
2. hash = sha256(refreshToken + pepper)
3. SELECT * FROM auth_sessions WHERE refresh_token_hash = :hash
   └─ tidak ada → 200 { ok:false, reason:'session_expired' }
4. Bila revoked_at IS NOT NULL:
   ⚠ PEMAKAIAN ULANG TERDETEKSI — token ini sudah pernah dirotasi.
     Kemungkinan besar token dicuri.
     UPDATE auth_sessions SET revoked_at = NOW(), revoked_reason = 'reuse_detected'
      WHERE user_id = :user_id AND revoked_at IS NULL
     → 200 { ok:false, reason:'session_expired' }
5. Bila expires_at < NOW() → 200 { ok:false, reason:'session_expired' }
6. ROTASI (aturan S10), dalam satu transaksi:
   UPDATE auth_sessions SET revoked_at = NOW(), revoked_reason = 'rotated'
    WHERE id = :old_id
   INSERT auth_sessions (user_id, refresh_token_hash = hash(token baru),
                         device_label = device_label lama,
                         expires_at = NOW() + 30 hari)
7. accessToken = await signAccessToken(user_id)
8. return 200 { ok:true, accessToken, refreshToken: tokenBaru, expiresIn: 3600 }
```

### `auth-signout`

```
1. userId = await requireUser(req)               → 401 bila tidak valid
2. Baca body { refreshToken, allDevices? }
3. allDevices === true
   → UPDATE auth_sessions SET revoked_at = NOW(), revoked_reason = 'signout'
      WHERE user_id = :userId AND revoked_at IS NULL
   sebaliknya
   → UPDATE ... WHERE refresh_token_hash = :hash AND user_id = :userId
4. return 200 { ok:true }

Aplikasi menghapus token dari SecureStore SEBELUM memanggil fungsi ini,
dan tetap menganggap keluar berhasil meskipun panggilannya gagal.
Warga yang menekan "Keluar" harus benar-benar keluar, apa pun keadaan jaringan.
```

### Manajemen sesi di sisi aplikasi

`apps/mobile/src/lib/session.ts` adalah satu-satunya berkas yang boleh menyentuh SecureStore.

```ts
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'sigap.refresh_token';
const SKEW_SECONDS = 60;   // segarkan 1 menit sebelum benar-benar kedaluwarsa

let accessToken: string | null = null;   // HANYA di memori (aturan S11)
let expiresAtMs = 0;
let refreshing: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < expiresAtMs - SKEW_SECONDS * 1000) return accessToken;

  // Satu panggilan refresh dalam satu waktu. Tanpa penjaga ini, lima query
  // paralel akan memicu lima rotasi dan empat di antaranya dianggap
  // pemakaian ulang token — seluruh sesi warga tercabut tanpa sebab.
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function doRefresh(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!stored) return null;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ refreshToken: stored }),
  });
  const data = await res.json();

  if (!data?.ok) { await clearSession(); return null; }

  accessToken = data.accessToken;
  expiresAtMs = Date.now() + data.expiresIn * 1000;
  await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);

  // WAJIB: tanpa baris ini, langganan Realtime jatuh ke peran anon dan
  // timeline (M1) serta antrean SOS (M5) berhenti menerima pembaruan.
  supabase.realtime.setAuth(accessToken!);

  return accessToken;
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  expiresAtMs = 0;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
```

> ### TIGA KESALAHAN YANG PALING SERING TERJADI DI SINI
>
> 1. **Refresh paralel.** Lima query React Query yang berjalan bersamaan saat token kedaluwarsa akan memicu lima `auth-refresh`. Empat di antaranya memakai token yang sudah dirotasi, terdeteksi sebagai pencurian, dan mencabut seluruh sesi. Penjaga `refreshing` di atas wajib ada, dan wajib punya test.
> 2. **Lupa `realtime.setAuth`.** Gejalanya jahat: tidak ada error, tidak ada log, timeline hanya diam.
> 3. **Menyimpan access token di AsyncStorage** "supaya tidak perlu refresh saat buka aplikasi". Melanggar S11, dan tidak ada gunanya — refresh hanya butuh satu panggilan jaringan yang berjalan di balik splash screen.

## 7.7 Aturan kegagalan AI

> ### EMPAT ATURAN YANG TIDAK BOLEH DILANGGAR
>
> 1. **Simpan dulu, perkaya kemudian.** Baris masuk database sebelum AI dipanggil. AI hanya menambahkan kolom, tidak pernah menjadi syarat penyimpanan.
> 2. **Kegagalan AI bukan kegagalan pengguna.** Jangan tampilkan pesan error teknis. Tampilkan: *"Laporan Anda sudah kami terima. Petugas akan memeriksanya secara manual."*
> 3. **Timeout keras 8 detik.** Warga tidak akan menunggu lebih lama sambil berdiri di pinggir jalan.
> 4. **SOS tidak menyentuh AI sama sekali.** Modul M5 memiliki jalur terpisah yang tidak melewati Groq, tidak melewati klasifikasi, dan tidak menunggu embedding.

## 7.8 Aturan kegagalan email — BARU di v2.0

> ### EMPAT ATURAN YANG SETARA PENTINGNYA
>
> 1. **Email gagal tidak boleh meninggalkan kode menggantung.** Bila Resend menolak, kode langsung ditandai terpakai (aturan T11). Kalau tidak, warga terkunci 60 detik oleh cooldown untuk kode yang tidak pernah ia terima.
> 2. **Jangan pernah menampilkan pesan error Resend kepada warga.** "Domain not verified" tidak berarti apa-apa bagi Bu Sri. Tampilkan: *"Gagal mengirim email. Periksa alamatnya lalu coba lagi."*
> 3. **Kuota adalah batas produk, bukan detail teknis.** Tier gratis Resend memberi 3.000 email per bulan dengan **batas 100 per hari** — dan setiap permintaan kode menghabiskan satu. Sesi 30 hari (T9) adalah keputusan yang menjaga angka ini tetap masuk akal. Lihat Bagian 15.3.
> 4. **Kegagalan email tidak boleh menjatuhkan aplikasi.** Warga yang sudah punya sesi aktif tidak terpengaruh sama sekali kalau Resend mati. Hanya login baru yang terhambat.

---

# 8 · Navigasi Aplikasi

## 8.1 Peta rute Expo Router

```
app/
├── _layout.tsx                  AuthProvider → QueryClientProvider → AuthGate
│
├── (auth)/                      Grup: hanya untuk yang belum masuk
│   ├── login.tsx                Email → "Kirim Kode"
│   ├── verify.tsx    ?email=    Enam digit OTP + kirim ulang
│   └── onboarding.tsx           Nama, kelurahan, kecamatan
│
├── (tabs)/                      Grup: tab bar utama, wajib sudah masuk
│   ├── _layout.tsx
│   ├── index.tsx                Beranda            ikon rumah
│   ├── feed.tsx                 Feed               ikon peta
│   ├── report.tsx               Lapor              TOMBOL TENGAH MENONJOL
│   ├── aspirasi.tsx             Aspirasi           ikon suara
│   └── profile.tsx              Profil             ikon orang
│
├── report/
│   ├── review.tsx    ?id=       Konfirmasi hasil AI
│   ├── duplicate.tsx ?id=       Tawaran dukung laporan yang ada
│   └── [id].tsx                 Detail + timeline + SLA
│
├── aspirasi/
│   ├── new.tsx
│   ├── [id].tsx                 Detail + tombol dukung
│   ├── musrenbang.tsx           Peringkat prioritas
│   └── [id]/impact.tsx          Jejak menuju mata anggaran
│
├── budget/
│   ├── index.tsx                Treemap APBD
│   ├── [dinas].tsx              Rincian program per dinas
│   ├── project/[id].tsx         Peta, foto progres, kontraktor
│   └── ask.tsx                  Tanya AI tentang anggaran
│
├── service/
│   ├── index.tsx                Katalog layanan
│   ├── [type]/apply.tsx         Form + unggah + OCR
│   ├── track/[id].tsx           Lacak status permohonan
│   └── doc/[id].tsx             PDF + QR verifikasi
│
├── sos/
│   ├── index.tsx                Tekan-tahan 3 detik
│   ├── type.tsx                 Pilih jenis darurat
│   └── [id].tsx                 Status respons langsung
│
├── info/
│   ├── index.tsx                Pengumuman & kontak dinas
│   └── [id].tsx
│
└── leaderboard.tsx              Peringkat kelurahan
```

## 8.2 Aturan navigasi

| Aturan | Penjelasan |
|---|---|
| **Lima tab, tidak lebih** | Tab keenam akan membuat label terpotong pada layar 5 inci. Modul M3, M4, M5, dan M6 dicapai dari kartu di Beranda, bukan dari tab. |
| **Tombol Lapor menonjol** | Tab tengah dirender sebagai lingkaran `primary` yang naik 12 px di atas tab bar. Ini aksi utama aplikasi. |
| **SOS selalu dapat dijangkau** | Tombol SOS melayang di pojok kanan bawah pada tab Beranda dan Feed. Tidak pernah tersembunyi di dalam menu. |
| **AuthGate satu tempat** | Pengalihan masuk/keluar hanya terjadi di `app/_layout.tsx`. Jangan menaruh `router.replace` berbasis sesi di layar lain — akan menimbulkan pengalihan berulang. |
| **Onboarding wajib sekali** | Bila `profile.kelurahan` masih NULL setelah masuk, alihkan ke `(auth)/onboarding`. Kelurahan menentukan feed, voting, dan leaderboard. |
| **Kembali tidak membuang data** | Menekan tombol kembali dari `report/review` tidak menghapus aduan yang sudah tersimpan. Aduan tetap ada di riwayat dengan statusnya. |
| **Layar verify tidak boleh menjadi buntu** | Dari `(auth)/verify`, tombol kembali selalu membawa ke `(auth)/login` dengan email masih terisi — bukan keluar dari aplikasi. Warga yang salah ketik email harus bisa memperbaikinya tanpa menutup aplikasi. |

### Implementasi AuthGate

```tsx
// apps/mobile/app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@sigap/shared';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

function AuthGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) { router.replace('/(auth)/login'); return; }

    if (session && profile && !profile.kelurahan) {
      router.replace('/(auth)/onboarding'); return;
    }
    if (session && profile?.kelurahan && inAuthGroup) router.replace('/(tabs)');
  }, [session, profile?.kelurahan, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center',
                     backgroundColor: colors[mode].background }}>
        <ActivityIndicator color={colors[mode].primary} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AuthGate /></AuthProvider>
    </QueryClientProvider>
  );
}
```

> **Perubahan v2.0 pada AuthGate:** `session` tidak lagi berasal dari `supabase.auth.onAuthStateChange`. `AuthProvider` menentukannya sendiri saat aplikasi dibuka: panggil `getValidAccessToken()` sekali, dan bila mengembalikan token, muat `profiles` untuk pengguna itu. Selama proses ini `loading` bernilai `true` — inilah alasan splash screen tidak boleh disembunyikan lebih cepat.

## 8.3 Peta rute Dashboard Staf (apps/web) — BARU

Bagian 8.1 hanya mencakup `apps/native`. Errata Bagian 0.3 menyebut `apps/admin` — implementasi memakai `apps/web`. Sebelum ini, navigasi dashboard staf tidak dirinci di PRD; subbagian ini melengkapinya berdasarkan acuan desain yang disepakati.

```
app/
├── page.tsx                     Ringkasan — KPI + antrean singkat, landing seluruh peran staf
├── aduan/
│   ├── page.tsx                 Antrean aduan gabungan (verifier + dinas, tab per peran)
│   └── — /verifikasi, /dinas menjadi redirect ke /aduan, tautan lama tidak putus
├── aspirasi/page.tsx            Musrenbang & tinjau aspirasi warga
├── layanan/page.tsx             Verifikasi dokumen & permohonan layanan
├── pengumuman/page.tsx          Terbitkan pengumuman & papan peringkat
├── anggaran/page.tsx            Indeks pencarian & item anggaran
├── warga/page.tsx               Direktori & statistik warga per kelurahan — BARU
├── darurat/page.tsx             Antrean SOS (emergency_operator)
├── pengguna/page.tsx            Kelola akun staf (admin)
├── login/page.tsx
└── verify/[code]/page.tsx       Verifikasi dokumen publik (QR, tanpa login)
```

### Cakupan peran di Ringkasan

| Peran | Cakupan data |
|---|---|
| `verifier`, `admin` | Se-kelurahan (seluruh dinas) |
| `dinas_staff`, `dinas_head` | Dinas sendiri, via `current_dinas_id()` |
| `emergency_operator` | Versi ringkas, fokus antrean SOS aktif |

### KPI Ringkasan & sumber data

| Kartu | Definisi | Sumber |
|---|---|---|
| Aduan baru hari ini | `complaints.created_at` = hari ini, discope sesuai peran | Agregat baru |
| Menunggu tanggapan | status `pending`/`verified`, plus jumlah yang mendekati batas SLA (≤20% waktu tersisa — threshold sama dengan `SlaCountdown` di native) | Agregat baru |
| Selesai pekan ini | status `resolved` 7 hari terakhir, dengan delta versus pekan sebelumnya | Agregat baru |
| Rata-rata respons | rata-rata jarak `created_at` ke transisi status pertama menjadi `verified` — bukan waktu sampai selesai, yang sudah dilacak lewat SLA countdown terpisah | Agregat baru |
| Beban per kategori | `COMPLAINT_CATEGORY_GROUPS` (Jalan, Sampah, Air, Penerangan, Keamanan) — pengelompokan tampilan atas kategori aduan mentah, pola sama dengan `BUDGET_SECTORS` | `packages/shared` (baru) |
| Kepatuhan SLA 7 hari | persentase `resolved_at <= sla_due_at`, per hari, 7 hari terakhir | Agregat baru |
| Perlu keputusan | gabungan `aspirations.status = 'musrenbang'` dan `service_requests.status = 'verifying'`, tombol Setuju/Tolak memakai mutation yang sudah ada (`updateAspirationStatus`, `updateServiceRequestStatus`) | Query gabungan |

### Pemetaan status "Aduan masuk"

| Chip filter | Enum `complaint_status` |
|---|---|
| Baru | `pending_classification`, `pending` |
| Diproses | `verified` |
| Diteruskan | `in_progress` |
| Selesai | `resolved` |
| Ditolak | `rejected` |

---

# 9 · Spesifikasi Modul

Setiap modul dijabarkan dengan format yang sama: **tujuan**, **cerita pengguna**, **layar** beserta isinya, **hook data**, dan **kriteria penerimaan**. Kriteria penerimaan ditulis agar dapat diverifikasi — bukan "berfungsi dengan baik", melainkan pernyataan yang bisa dinyatakan benar atau salah.

## 9.1 M0 · Auth & Onboarding

> **Ditulis ulang di v2.0.** Modul ini tidak lagi memakai Supabase Auth. Bagian 7.6 adalah acuan teknisnya dan wajib dibaca lebih dulu.

**Tujuan:** warga dapat masuk hanya dengan alamat email, tanpa kata sandi, dan sistem tahu kelurahan tempatnya tinggal — karena kelurahan menentukan feed, hak voting, dan leaderboard.

### Cerita pengguna

- Sebagai warga, saya ingin masuk tanpa membuat kata sandi baru, agar tidak ada satu hal lagi yang harus saya ingat.
- Sebagai warga, saya ingin cukup masuk sekali dan tidak diminta memasukkan kode lagi setiap membuka aplikasi.
- Sebagai warga yang salah mengetik alamat email, saya ingin bisa memperbaikinya tanpa menutup aplikasi.
- Sebagai warga, saya ingin memilih kelurahan sekali saja saat pertama kali, agar aplikasi langsung menampilkan hal yang relevan bagi saya.

### Layar

| Rute | Isi & perilaku |
|---|---|
| `(auth)/login` | Logo SIGAP, satu kolom alamat email dengan `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`. Tombol "Kirim Kode". Di bawahnya satu baris kecil: "Kami kirim kode enam digit ke email Anda. Tidak perlu kata sandi." |
| `(auth)/verify?email=` | Alamat email ditampilkan di atas beserta tautan kecil "Ganti email" yang kembali ke login. `<OtpInput>` enam kotak, fokus otomatis. Tombol "Masuk". `<CooldownButton>` "Kirim ulang kode" aktif setelah 60 detik. Tombol sekunder **"Buka aplikasi email"**. |
| `(auth)/onboarding` | Tiga langkah dalam satu layar bergulir: nama lengkap, pilih kecamatan (dropdown), pilih kelurahan (dropdown yang tersaring oleh kecamatan). Tombol "Mulai" menyimpan ke `profiles` dan mengalihkan ke `(tabs)`. |

### Alur utama

```
[login]  Warga mengetik email → "Kirim Kode"
   │
   │  invoke auth-request-otp { email }
   │  ├─ ok:false rate_limited   → tampilkan hitung mundur, tetap di login
   │  ├─ ok:false email_failed   → "Gagal mengirim email. Periksa alamatnya lalu coba lagi."
   │  └─ ok:true                 → navigasi ke verify?email=...
   ▼
[verify] Warga mengetik enam digit (atau autofill dari notifikasi)
   │
   │  invoke auth-verify-otp { email, code, deviceLabel }
   │  ├─ ok:false invalid_code       → kotak memerah, "Kode salah atau sudah kedaluwarsa."
   │  ├─ ok:false too_many_attempts  → "Terlalu banyak percobaan. Minta kode baru."
   │  └─ ok:true → simpan refreshToken ke SecureStore
   │               set accessToken di memori
   │               supabase.realtime.setAuth(accessToken)
   │               muat profiles
   ▼
AuthGate memeriksa profile.kelurahan
   ├─ NULL      → [onboarding]
   └─ terisi    → [(tabs)]
```

### Hook

```ts
// apps/mobile/src/hooks/useAuth.tsx
interface AuthValue {
  session: { userId: string } | null;
  profile: Tables<'profiles'> | null;
  loading: boolean;

  /** Meminta kode. Mengembalikan cooldown agar layar dapat menghitung mundur. */
  requestOtp: (email: string) => Promise<
    { ok: true; cooldownSeconds: number } |
    { ok: false; reason: 'rate_limited' | 'email_failed' | 'invalid_email';
      retryAfterSeconds?: number }
  >;

  /** Memverifikasi kode dan membuat sesi. */
  verifyOtp: (email: string, code: string) => Promise<
    { ok: true; isNewUser: boolean } |
    { ok: false; reason: 'invalid_code' | 'too_many_attempts' | 'account_disabled' }
  >;

  completeOnboarding: (input: {
    fullName: string; kelurahan: string; kecamatan: string;
  }) => Promise<void>;

  signOut: (allDevices?: boolean) => Promise<void>;
}
```

`useAuth` **tidak pernah** memanggil `supabase.auth.*`. Seluruh percakapan sesi terjadi lewat `supabase.functions.invoke('auth-…')` dan `src/lib/session.ts`.

### Kriteria penerimaan

1. Email dengan kapitalisasi berbeda (`Budi@Mail.com` dan `budi@mail.com`) masuk ke akun yang **sama** — dijamin kolom `CITEXT`, diuji lewat query langsung.
2. Kode OTP salah menampilkan *"Kode salah atau sudah kedaluwarsa. Coba kirim ulang."* — bukan pesan error dari pustaka atau dari Resend.
3. Meminta kode dua kali berturut-turut dalam 60 detik ditolak oleh **database**, bukan oleh tombol yang dinonaktifkan. Diuji dengan memanggil Edge Function langsung lewat `curl`.
4. Meminta kode empat kali dalam satu jam untuk email yang sama: permintaan keempat mengembalikan `rate_limited`.
5. Kode lama tidak berlaku setelah kode baru diminta — dijamin indeks unik parsial `auth_otp_one_active_idx`.
6. Lima kali salah kode membuat kode itu mati; kode baru harus diminta.
7. Kode kedaluwarsa setelah 10 menit, diuji dengan menggeser `expires_at` lewat SQL.
8. **Baris `auth_otp_codes` tidak pernah memuat kode dalam bentuk terbaca.** Diuji dengan `SELECT code_hash FROM auth_otp_codes` — hasilnya 64 karakter heksadesimal, dan mencari kode enam digit di seluruh kolom tidak menemukan apa pun.
9. Respons `auth-request-otp` untuk email yang belum pernah terdaftar **identik byte-per-byte** dengan email yang sudah terdaftar (aturan S9).
10. Sesi bertahan setelah aplikasi ditutup paksa (diuji dengan *force stop* lalu buka lagi). Warga tidak diminta kode lagi.
11. Sesi bertahan melewati batas satu jam: access token disegarkan otomatis tanpa warga menyadarinya. Diuji dengan membiarkan aplikasi terbuka lebih dari satu jam, atau memperpendek `ACCESS_TOKEN_TTL_SECONDS` sementara.
12. Memakai refresh token yang sudah dirotasi mencabut **seluruh** sesi pengguna itu, dan aplikasi mengalihkan ke layar masuk dengan pesan *"Sesi Anda berakhir. Silakan masuk kembali."*
13. Lima query berjalan bersamaan saat token kedaluwarsa hanya memicu **satu** panggilan `auth-refresh`. Diuji dengan `Promise.all` atas lima query dan menghitung baris baru di `auth_sessions`.
14. `supabase.realtime.setAuth()` dipanggil setiap kali token berganti — dibuktikan dengan langganan timeline yang tetap hidup setelah token disegarkan.
15. Refresh token tersimpan di SecureStore, **tidak** di AsyncStorage. Diuji dengan membaca seluruh isi AsyncStorage dan memastikan tidak ada nilai yang menyerupai token.
16. Pengguna dengan `kelurahan` masih NULL selalu diarahkan ke onboarding, meskipun menutup dan membuka aplikasi kembali.
17. Menekan "Kirim Kode" dua kali cepat hanya mengirim satu email — dijaga oleh cooldown database dan oleh tombol yang masuk keadaan `loading`.
18. `devCode` tidak pernah muncul di respons ketika `OTP_DEV_MODE` tidak diset. Ada test Deno yang membuktikannya.

### Pengujian lokal

```bash
# supabase/.env.local — HANYA lokal
OTP_DEV_MODE=true

# Minta kode; kodenya akan tercetak di log `supabase functions serve`
curl -s -X POST http://localhost:54321/functions/v1/auth-request-otp \
  -H "Content-Type: application/json" -H "apikey: $ANON_KEY" \
  -d '{"email":"warga@sigap.test"}'

# Tukar dengan sesi
curl -s -X POST http://localhost:54321/functions/v1/auth-verify-otp \
  -H "Content-Type: application/json" -H "apikey: $ANON_KEY" \
  -d '{"email":"warga@sigap.test","code":"123456","deviceLabel":"curl"}'
```

Untuk menguji jalur email yang sesungguhnya tanpa menghabiskan kuota, pakai alamat `delivered@resend.dev` — alamat uji Resend yang selalu berhasil tanpa benar-benar mengirim ke kotak masuk siapa pun.

## 9.2 M1 · LAPOR

**Tujuan:** warga dapat melaporkan masalah publik dalam waktu kurang dari 30 detik, dan aduan itu sampai ke dinas yang benar dengan urgensi terukur tanpa campur tangan manusia.

### Cerita pengguna

- Sebagai warga yang sedang berdiri di depan jalan berlubang, saya ingin memotret, menulis satu kalimat, dan mengirim — tanpa memilih kategori atau dinas.
- Sebagai warga, saya ingin tahu laporan saya diterima siapa dan kapan akan ditangani.
- Sebagai warga, saya ingin diberi tahu bila sudah ada laporan serupa di dekat lokasi itu, agar saya cukup mendukungnya.
- Sebagai petugas dinas, saya ingin antrean yang sudah terurut prioritas, bukan tumpukan teks mentah.

### Alur utama

```
[report]  Kamera terbuka lebih dulu
   │  foto diambil → GPS diminta otomatis di latar belakang
   │  foto dikompres ke lebar maks 1280 px → unggah ke storage
   ▼
[report]  Satu kolom: "Ada masalah apa?" (minimal 20 karakter)
   │  tombol "Kirim Laporan" aktif bila: ≥1 foto, ≥20 karakter, GPS ada
   ▼
INSERT complaints (status = pending_classification)   ← data aman di sini
   │
   ├── invoke classify-report (maks 8 detik)
   │     ├─ ok:true  + duplicates kosong → [report/review]
   │     ├─ ok:true  + duplicates ada    → [report/duplicate]
   │     └─ ok:false                     → [report/review] mode manual
   ▼
[report/review]  Tampilkan hasil AI, warga boleh mengoreksi
   │  koreksi warga disimpan dan menjadi bahan evaluasi akurasi
   ▼
[report/[id]]  Timeline, countdown SLA, tombol dukung, bagikan
```

### Layar

| Rute | Isi | Keadaan khusus |
|---|---|---|
| `(tabs)/report` | Judul "Ada masalah apa?", subjudul "Foto dulu, sisanya kami bantu isi." `<PhotoPicker>` besar di atas, kolom deskripsi multi-baris, `<LocationPicker>` ringkas, tombol kirim menempel di bawah. | Izin kamera ditolak → jelaskan mengapa dibutuhkan, sediakan tombol ke pengaturan. GPS gagal → izinkan pilih lokasi manual di peta. Reverse geocode gagal → tampilkan koordinat, jangan blokir. |
| `report/review` | Kartu hasil AI: judul, `<UrgencyBadge>`, nama dinas, ringkasan, `<AiBadge confidence>`. Tombol "Sudah benar" dan "Perbaiki". Mode perbaiki membuka pemilih dinas dan urgensi. | AI gagal → tampilkan *"Laporan Anda sudah kami terima. Petugas akan memeriksanya secara manual."* Tanpa nada error. |
| `report/duplicate` | Daftar 1–5 laporan mirip dengan foto, jarak dalam meter, jumlah dukungan. Tombol utama "Dukung laporan ini", tombol sekunder "Tetap kirim laporan baru". | Bila warga memilih dukung: laporan barunya diberi `duplicate_of`, dan sebuah baris `complaint_upvotes` dibuat. |
| `report/[id]` | Galeri foto, judul, badge, dinas penanggung jawab beserta nama kepala dinas, `<SlaCountdown>`, `<Timeline>`, tombol dukung dan bagikan. | Timeline berlangganan Realtime — entri baru muncul tanpa perlu tarik-untuk-muat-ulang. **Wajib memastikan `realtime.setAuth` sudah dipanggil (lihat 7.6).** |
| `(tabs)/feed` | Peta memenuhi layar dengan marker berwarna urgensi; sheet daftar dapat ditarik dari bawah. Filter: kelurahan, kategori, status, urgensi. Urutan: terbaru / paling didukung / paling mendesak. | Tanpa koneksi → tampilkan data terakhir dari cache React Query dengan bilah "Menampilkan data tersimpan". |

> **Catatan peta (v2.0):** `<MapView>` dipakai tanpa prop `provider` agar iOS jatuh ke Apple Maps dan Android ke Google Maps — keduanya berbiaya nol (Bagian 4.6). Jangan memuat ulang komponen peta pada setiap perubahan filter; ubah saja daftar marker. Memuat ulang `MapView` memicu instansiasi peta baru dan membuat peta berkedip.

### Skema validasi

```ts
// packages/shared/src/schemas.ts
import { z } from 'zod';
import { DINAS_LIST, CATEGORY_LIST } from './constants';

const dinasIds   = DINAS_LIST.map((d) => d.id) as [string, ...string[]];
const categories = CATEGORY_LIST as unknown as [string, ...string[]];

// Batas kasar wilayah Indonesia — mencegah koordinat nol atau salah benua.
const latitude  = z.number().min(-11).max(6);
const longitude = z.number().min(95).max(141);

export const createComplaintSchema = z.object({
  description: z.string().trim()
    .min(20, 'Ceritakan lebih detail, minimal 20 karakter').max(2000),
  locationLat: latitude,
  locationLng: longitude,
  locationAddress: z.string().max(300).optional(),
  imageUrls: z.array(z.string().url())
    .min(1, 'Wajib melampirkan minimal satu foto').max(5),
});
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const aiClassificationSchema = z.object({
  title: z.string().trim().min(5).max(120),
  category: z.enum(categories),
  assignedDinas: z.enum(dinasIds),
  urgency: z.enum(['P0','P1','P2']),
  summary: z.string().trim().min(10).max(500),
  confidence: z.number().min(0).max(1),
});
export type AiClassification = z.infer<typeof aiClassificationSchema>;

// BARU di v2.0 — dipakai layar login.
export const emailSchema = z.string().trim().toLowerCase()
  .email('Alamat email tidak valid').max(254);

export const otpCodeSchema = z.string().trim()
  .regex(/^\d{6}$/, 'Kode terdiri dari enam angka');
```

### Hook `useCreateComplaint`

```ts
export interface SubmitResult {
  complaintId: string;
  /** false berarti AI tidak tersedia; aduan tetap tersimpan untuk klasifikasi manual. */
  classified: boolean;
  duplicates: DuplicateCandidate[];
}

export function useCreateComplaint() {
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();

  async function submit(input: CreateComplaintInput): Promise<SubmitResult> {
    const parsed = createComplaintSchema.parse(input);
    if (busy) throw new Error('Laporan sedang dikirim');   // cegah kirim ganda
    setBusy(true);
    try {
      // v2.0: identitas datang dari sesi SIGAP, bukan supabase.auth.getUser().
      if (!session) throw new Error('Sesi berakhir, silakan masuk kembali');

      // Simpan dulu. Aduan tidak boleh hilang hanya karena AI sedang mati.
      const { data: row, error } = await supabase.from('complaints').insert({
        user_id: session.userId,
        description: parsed.description,
        location_lat: parsed.locationLat,
        location_lng: parsed.locationLng,
        location_address: parsed.locationAddress ?? null,
        image_urls: parsed.imageUrls,
        status: 'pending_classification',
      }).select('id').single();

      if (error || !row) throw new Error(error?.message ?? 'Gagal menyimpan aduan');

      const { data: fn } = await supabase.functions.invoke('classify-report', {
        body: { complaintId: row.id },
      });

      return {
        complaintId: row.id,
        classified: fn?.ok === true,
        duplicates: fn?.duplicates ?? [],
      };
    } finally { setBusy(false); }
  }

  return { submit, busy };
}
```

### Kriteria penerimaan

1. Aduan tersimpan di database **sebelum** Edge Function dipanggil. Dibuktikan dengan mematikan Edge Function lalu mengirim aduan: barisnya tetap ada dengan status `pending_classification`.
2. Deskripsi kurang dari 20 karakter tidak dapat dikirim, dengan pesan *"Ceritakan lebih detail, minimal 20 karakter"*.
3. Aduan tanpa foto tidak dapat dikirim.
4. Koordinat di luar wilayah Indonesia ditolak skema Zod.
5. Klasifikasi selesai kurang dari 5 detik pada koneksi normal, diukur dari `created_at` ke event `ai_classified`.
6. `sla_due_at` terisi sesuai tabel SLA dinas yang dipilih AI. Untuk P1 di PUPR: tepat 72 jam setelah klasifikasi.
7. Duplikat hanya ditawarkan bila **kedua** syarat terpenuhi: kemiripan > 0,85 **dan** jarak < 500 m.
8. Menekan tombol kirim dua kali cepat hanya menghasilkan satu baris `complaints`.
9. Timeline diperbarui secara langsung lewat Realtime tanpa muat ulang manual — **termasuk sesudah access token disegarkan**.
10. Satu warga hanya dapat mendukung satu aduan sekali — dijaga oleh primary key gabungan, bukan oleh aplikasi.
11. Unggah foto ke folder `{user_id}/` berhasil dengan token SIGAP; unggah ke folder milik warga lain ditolak Storage dengan 403.

## 9.3 M2 · ASPIRASI

**Tujuan:** warga dapat mengusulkan pembangunan, memilih usulan tetangganya, dan menelusuri usulan yang menang sampai menjadi mata anggaran nyata.

### Cerita pengguna

- Sebagai warga, saya ingin mengusulkan pembangunan di kelurahan saya dan melihat berapa orang yang mendukungnya.
- Sebagai warga, saya ingin membuktikan bahwa usulan yang menang benar-benar masuk anggaran — bukan sekadar dicatat.
- Sebagai admin, saya ingin membuka dan menutup periode voting agar selaras dengan jadwal Musrenbang.

### Layar

| Rute | Isi |
|---|---|
| `(tabs)/aspirasi` | Bilah periode voting aktif beserta hitung mundur penutupan. Daftar usulan di kelurahan pengguna, terurut jumlah suara. Setiap kartu: judul, jumlah penerima manfaat, suara, tombol dukung. Tombol mengambang "Usulkan". |
| `aspirasi/new` | Tiga pertanyaan berurutan, satu per layar geser: (1) "Apa yang ingin dibangun atau diperbaiki?" (2) "Di mana lokasinya?" — peta. (3) "Berapa orang yang akan merasakan manfaatnya?" — angka. Foto opsional. |
| `aspirasi/[id]` | Detail usulan, peta lokasi, daftar pendukung (nama depan + kelurahan), tombol dukung/batal dukung, status perjalanan usulan. |
| `aspirasi/musrenbang` | Peringkat usulan yang lolos ke Musrenbang untuk seluruh kecamatan, beserta peringkat dan perkiraan biaya. |
| `aspirasi/[id]/impact` | Jejak visual: Usulan → Voting (N suara) → Musrenbang (peringkat X) → Mata anggaran (Rp Y) → Realisasi (Z%). Setiap tahap dengan tanggal. |

### Aturan bisnis

| Aturan | Penegakan |
|---|---|
| Satu warga satu suara per usulan | Primary key gabungan `(aspiration_id, user_id)` di database |
| Hanya boleh memilih di kelurahan sendiri | Policy RLS `votes_insert_own` memeriksa `a.kelurahan = p.kelurahan` |
| Voting hanya dalam periode aktif | Policy RLS memeriksa `NOW() BETWEEN vp.starts_at AND vp.ends_at` |
| Usulan tidak dapat diubah setelah lolos voting | Policy `aspirations_owner_update` hanya berlaku saat `status = 'voting'` |
| Perubahan status hanya oleh admin/dinas_head | Policy `aspirations_admin_update` |

### Kriteria penerimaan

1. Warga kelurahan A mencoba memilih usulan di kelurahan B: **database** menolaknya, bukan aplikasi. Diuji langsung lewat `supabase-js` tanpa melewati antarmuka.
2. Memilih dua kali menghasilkan pelanggaran primary key, dan antarmuka menerjemahkannya menjadi *"Anda sudah mendukung usulan ini"*.
3. `vote_count` selalu sama dengan jumlah baris di `aspiration_votes` — diuji dengan menambah dan membatalkan suara berulang kali.
4. Di luar periode voting, tombol dukung tidak aktif dan menampilkan tanggal periode berikutnya.
5. Layar dampak hanya menampilkan tahap yang benar-benar sudah terjadi; tahap mendatang ditampilkan pudar, bukan disembunyikan.

## 9.4 M3 · ANGGARAN

**Tujuan:** APBD dapat dibaca warga biasa, ditelusuri sampai tingkat proyek, dan ditanyakan dengan bahasa sehari-hari.

### Layar

| Rute | Isi |
|---|---|
| `budget/index` | Total APBD tahun berjalan dalam angka besar, treemap SVG per dinas dengan luas kotak sebanding pagu dan warna sebanding persen realisasi. Menyentuh kotak membuka rincian dinas. |
| `budget/[dinas]` | Daftar program: nama, pagu, realisasi, bilah progres. Urut menurut pagu terbesar. Filter tahun anggaran. |
| `budget/project/[id]` | Peta lokasi proyek, foto progres, persen realisasi, nama kontraktor, pagu vs realisasi dalam rupiah penuh. Bila proyek berasal dari aspirasi, tampilkan tautan balik ke usulan aslinya. |
| `budget/ask` | Kolom pertanyaan bebas dengan contoh pertanyaan yang dapat disentuh: *"Berapa anggaran perbaikan jalan di kecamatan saya?"* Jawaban AI disertai kartu sumber yang dapat disentuh menuju mata anggarannya. |

### Alur RAG `ask-budget`

```
1. Terima { question, fiscalYear?, kelurahan? }
2. Panggil embed-text untuk pertanyaan → vektor 384 dimensi
3. Panggil search_budget_items(vektor, 8, fiscalYear) → 8 mata anggaran terdekat
4. Susun prompt dengan buildBudgetAnswerPrompt(question, items)
5. Panggil callGroq → JSON { answer, sourceIndexes }
6. Kembalikan { ok:true, answer, sources: items terpilih }
   Kegagalan mana pun → { ok:false, reason:'ai_unavailable' }
```

> ### PAGAR PENGAMAN JAWABAN ANGGARAN
>
> Model dilarang keras mengarang angka. Prompt mewajibkan jawaban hanya dari konteks yang diberikan, dan setiap angka dalam jawaban harus dapat ditelusuri ke kartu sumber. Bila konteks tidak memuat jawabannya, model wajib mengatakan datanya tidak tersedia. Antarmuka **selalu** menampilkan kartu sumber di bawah jawaban — jawaban tanpa sumber tidak boleh ditampilkan.

### Impor data APBD

Data masuk lewat impor CSV oleh admin di dashboard, bukan scraping. Format kolom CSV:

```
fiscal_year,dinas_id,program_name,activity_name,budget_allocated,
budget_realized,kelurahan,kecamatan,location_lat,location_lng,
progress_percent,contractor
```

Setelah impor, admin menjalankan aksi "Buat embedding" yang memanggil `embed-text` untuk setiap baris tanpa `embedding`.

### Kriteria penerimaan

1. Nilai rupiah ditampilkan lengkap dengan pemisah titik ribuan, format Indonesia: `Rp 1.250.000.000`.
2. Treemap tetap terbaca pada layar 5 inci: kotak dengan pagu kurang dari 2% digabung menjadi satu kotak "Lainnya".
3. Jawaban AI selalu disertai minimal satu kartu sumber. Jika model tidak mengembalikan `sourceIndexes`, jawaban tidak ditampilkan dan diganti pesan *"Belum ada data yang cocok dengan pertanyaan Anda"*.
4. Pertanyaan di luar topik anggaran dijawab dengan penolakan sopan, bukan halusinasi.
5. Impor CSV menolak baris dengan `budget_realized > budget_allocated` dan melaporkan nomor barisnya.

## 9.5 M4 · LAYANAN

**Tujuan:** warga dapat mengajukan surat administrasi tanpa datang ke kantor kelurahan, dan hasilnya dapat diverifikasi keasliannya oleh pihak ketiga.

### Katalog layanan

| Jenis | Nilai `service_type` | Dokumen yang diunggah |
|---|---|---|
| Surat Keterangan Domisili | `domisili` | KTP, KK |
| Surat Keterangan Tidak Mampu | `sktm` | KTP, KK, foto rumah |
| Surat Pengantar Nikah | `pengantar_nikah` | KTP kedua calon, KK |
| Izin Keramaian | `izin_keramaian` | KTP penyelenggara, proposal kegiatan |
| Surat Keterangan Usaha | `usaha` | KTP, foto tempat usaha |

### Layar

| Rute | Isi |
|---|---|
| `service/index` | Kartu per jenis layanan dengan ikon, perkiraan lama proses, dan daftar dokumen yang perlu disiapkan. Di bawahnya, riwayat permohonan pengguna dengan chip status. |
| `service/[type]/apply` | Langkah 1: unggah KTP → OCR mengisi otomatis nama, NIK, alamat, tanggal lahir. Langkah 2: warga memeriksa dan mengoreksi hasil OCR. Langkah 3: kolom tambahan khusus jenis layanan. Langkah 4: ringkasan dan kirim. |
| `service/track/[id]` | Empat tahap horizontal: Diajukan → Verifikasi → Tanda tangan → Siap diambil. Tahap aktif ditandai `accent`. Bila ditolak, tampilkan alasan dan tombol "Ajukan ulang" yang membawa data sebelumnya. |
| `service/doc/[id]` | Pratinjau PDF, tombol unduh dan bagikan, kode verifikasi enam karakter, dan QR yang mengarah ke halaman verifikasi publik. |

### Alur OCR

```
1. Foto KTP diunggah ke bucket PRIVAT service-docs sebagai {user_id}/{uuid}.jpg
2. Aplikasi memanggil ocr-doc { documentUrl (signed, 60 detik), docType: 'ktp' }
3. Edge Function membuat signed URL baru, mengirim gambar ke gemini-2.0-flash
4. Model mengembalikan { nik, nama, tempat_lahir, tanggal_lahir, alamat,
                         rt_rw, kelurahan, kecamatan, agama, status_perkawinan }
5. Setiap field disertai confidence. Field dengan confidence < 0.8 ditandai
   kuning di antarmuka dan wajib diperiksa warga sebelum lanjut.
6. Kegagalan mana pun → form kosong, warga mengisi manual. Bukan blokir.
```

> ### DATA IDENTITAS
>
> NIK dan foto KTP tidak pernah masuk bucket publik, tidak pernah muncul di log, **tidak pernah dikirim ke Groq, dan tidak pernah dikirim lewat email**. Hanya Gemini vision yang menerimanya, satu kali, lewat signed URL berumur 60 detik. Hasil OCR disimpan di kolom `form_data` JSONB pada `service_requests` yang hanya dapat dibaca pemilik dan petugas.

> ### VERIFIKASI DOKUMEN
>
> Setiap dokumen selesai mendapat `verification_code` enam karakter alfanumerik unik. QR pada PDF mengarah ke halaman publik pada dashboard admin yang menampilkan: jenis surat, nama pemohon, tanggal terbit, dan status keabsahan. Halaman ini **tidak** menampilkan NIK, alamat lengkap, maupun alamat email.

### Kriteria penerimaan

1. Bucket `service-docs` bersifat privat; percobaan mengakses berkas tanpa signed URL menghasilkan 403.
2. Warga A tidak dapat membaca permohonan warga B, diuji langsung lewat query `supabase-js`.
3. OCR gagal tidak memblokir permohonan; form tetap dapat diisi manual.
4. Field OCR dengan confidence di bawah 0,8 ditandai secara visual dan tidak dapat dilewati tanpa dikonfirmasi.
5. `verification_code` unik — dijamin oleh constraint `UNIQUE` di database.
6. Permohonan yang ditolak menyimpan `rejection_reason`, dan alasan itu tampil di layar pelacakan.

## 9.6 M5 · DARURAT

> ### MODUL PALING KRITIS
>
> Modul ini harus berfungsi ketika segala hal lain gagal. Tidak memanggil Groq, tidak menunggu klasifikasi, tidak menunggu embedding, tidak menunggu unggah foto selesai, **dan tidak pernah menunggu email apa pun**. Urutan prioritas: kirim koordinat → kirim jenis darurat → rekam audio → unggah audio. Tiga langkah pertama harus selesai dalam 3 detik.

### Layar

| Rute | Isi & perilaku |
|---|---|
| `sos/index` | Layar merah penuh. Satu lingkaran besar di tengah dengan teks "Tekan & tahan 3 detik". Lingkaran progres mengelilingi tombol saat ditahan. Getaran haptik setiap detik. Melepas sebelum 3 detik membatalkan tanpa mengirim apa pun. |
| `sos/type` | Muncul **setelah** alert terkirim, bukan sebelumnya. Enam kartu besar: Kebakaran, Medis, Banjir, Kriminal, Pohon Tumbang, Lainnya. Memilih jenis memperbarui baris yang sudah ada. |
| `sos/[id]` | Status langsung lewat Realtime: "Terkirim" → "Petugas sedang menuju lokasi" → "Ditangani". Menampilkan nama operator yang merespons dan waktunya. Tombol besar "Batalkan — ini keliru". |

### Alur teknis

```
Tekan-tahan 3 detik
   │
   ├─(1) Ambil koordinat terakhir yang diketahui (cache GPS)
   │     → jangan menunggu fix GPS baru; presisi kasar lebih baik
   │       daripada tidak ada laporan sama sekali
   │
   ├─(2) INSERT emergency_alerts
   │     { user_id, emergency_type:'other', lat, lng, status:'active' }
   │     → langsung navigasi ke sos/[id]. Warga melihat konfirmasi < 1 detik.
   │
   ├─(3) invoke dispatch-emergency { alertId }
   │     → push notification ke semua profil emergency_operator
   │     → tidak memblokir antarmuka
   │
   ├─(4) Mulai rekam audio 10 detik di latar belakang
   │     → selesai rekam, unggah ke emergency-audio
   │     → UPDATE audio_url. Gagal unggah tidak membatalkan alert.
   │
   └─(5) Perbarui koordinat presisi tinggi bila fix GPS akhirnya datang
```

> ### SESI KEDALUWARSA SAAT SOS — KASUS YANG WAJIB DITANGANI
>
> Ini risiko baru di v2.0 dan yang paling berbahaya di seluruh dokumen. Bila access token warga kebetulan kedaluwarsa tepat saat ia menekan SOS, `INSERT` akan ditolak RLS.
>
> Penanganan wajib: `sos/index` memanggil `getValidAccessToken()` **saat layar dibuka**, bukan saat tombol dilepas. Menahan tombol memakan 3 detik penuh — waktu yang lebih dari cukup untuk menyegarkan token di latar belakang. Bila penyegaran gagal, tampilkan peringatan **sebelum** warga menekan, bukan sesudah.
>
> Ada test wajib untuk ini: paksa `expiresAtMs = 0`, buka `sos/index`, tahan tombol, dan pastikan baris `emergency_alerts` tetap tercipta.

### Kriteria penerimaan

1. Dari lepas jari sampai layar konfirmasi muncul: kurang dari 1 detik pada perangkat kelas menengah.
2. Baris `emergency_alerts` tercipta meskipun izin mikrofon ditolak.
3. Baris tercipta meskipun Groq, Edge Function klasifikasi, dan seluruh lapisan AI dimatikan — diuji dengan mematikan semuanya.
4. **Baris tercipta meskipun access token sudah kedaluwarsa saat layar dibuka** — token disegarkan lebih dulu (lihat kotak di atas).
5. Melepas tekanan pada detik ke-2 tidak mengirim apa pun.
6. Operator menerima notifikasi kurang dari 5 detik setelah alert dibuat.
7. Warga dapat membatalkan alert palsu, dan statusnya menjadi `false_alarm` — bukan terhapus, agar dapat diaudit.
8. Warga hanya dapat melihat alert miliknya sendiri; operator dapat melihat semuanya. Ditegakkan RLS.

## 9.7 M6 · INFO & KOMUNITAS

**Tujuan:** mengubah partisipasi individual menjadi kebanggaan kelurahan, dan menjadi saluran resmi pengumuman pemerintah daerah.

### Layar

| Rute | Isi |
|---|---|
| `(tabs)/index` Beranda | Sapaan dengan nama, ringkasan "Laporan Anda: 3 diproses, 1 selesai". Kartu pengumuman yang disematkan. Enam kartu pintasan modul. Tombol SOS mengambang. Peringkat kelurahan pengguna saat ini. |
| `info/index` | Daftar pengumuman terurut tanggal, yang disematkan di atas. Filter: seluruh wilayah / kelurahan saya. Di bawahnya, direktori kontak dinas dengan tombol telepon langsung. |
| `leaderboard` | Dua tab: **Kelurahan** (peringkat berdasarkan aduan selesai dan tingkat partisipasi) dan **Warga** (peringkat poin di kelurahan pengguna). Peringkat kelurahan pengguna selalu terlihat, disematkan di bawah meskipun berada di luar sepuluh besar. |
| `(tabs)/profile` | Avatar, nama, kelurahan, total poin, lencana yang diraih, riwayat kontribusi dari `point_ledger` dalam bentuk daftar. **Daftar perangkat yang sedang masuk, dari `auth_sessions`, dengan tombol "Keluar dari semua perangkat".** Pengaturan: mode gelap, notifikasi, keluar. |

### Kriteria penerimaan

1. Total poin dihitung dari `SUM(points)` pada `point_ledger`, tidak pernah dari kolom yang di-increment.
2. Membatalkan aduan palsu menyisipkan baris poin negatif; total poin turun, riwayat tetap utuh dan dapat diaudit.
3. Batas +2 poin dukungan maksimal 20 poin per hari benar-benar berlaku — diuji dengan mendukung 15 laporan berturut-turut.
4. Leaderboard kelurahan dimuat kurang dari 1 detik untuk 50 kelurahan — dijamin materialized view `kelurahan_leaderboard` (Bagian 6.6), bukan view biasa.
5. Aplikasi tidak pernah menampilkan poin sebagai satu-satunya umpan balik atas laporan. Poin muncul bersama informasi status penanganan.
6. Layar profil menampilkan daftar perangkat aktif, dan "Keluar dari semua perangkat" benar-benar mencabut seluruh baris `auth_sessions` milik pengguna itu — diuji dengan mencoba `auth-refresh` memakai token dari perangkat kedua sesudahnya.
---

# 10 · UX Writing

Seluruh string antarmuka berada di satu berkas: `apps/mobile/src/i18n/copy.ts`. Tidak ada string yang ditulis langsung di dalam komponen. Ini membuat penyuntingan nada bahasa dapat dilakukan tanpa menyentuh logika. **Isi email juga tunduk pada aturan ini**, meskipun berkasnya berada di `supabase/functions/_shared/email-templates.ts`.

## 10.1 Kamus pengganti

| Jangan tulis | Tulis |
|---|---|
| Uraian Aduan | Ada masalah apa? |
| Status: Terdisposisi | Sudah sampai ke Dinas Pekerjaan Umum |
| Data tidak ditemukan | Belum ada laporan di sekitar sini. Jadilah yang pertama. |
| Terjadi kesalahan sistem | Koneksi sedang terganggu. Laporan Anda sudah tersimpan. |
| Silakan lengkapi form | Ceritakan lebih detail, minimal 20 karakter |
| Submit | Kirim Laporan |
| Loading... | Mengirim laporan Anda... |
| Permintaan Anda sedang diproses | Petugas Dinas Kesehatan sedang menangani laporan Anda |
| Anda tidak memiliki akses | Halaman ini hanya untuk petugas |
| **Autentikasi gagal** | **Kode salah atau sudah kedaluwarsa. Coba kirim ulang.** |
| **Rate limit exceeded** | **Tunggu 47 detik sebelum meminta kode lagi.** |
| **Email delivery failed** | **Gagal mengirim email. Periksa alamatnya lalu coba lagi.** |
| **Token expired** | **Sesi Anda berakhir. Silakan masuk kembali.** |
| **Masukkan OTP** | **Masukkan enam angka yang kami kirim** |

## 10.2 Contoh isi `copy.ts`

```ts
export const copy = {
  common: {
    retry: 'Coba Lagi',
    cancel: 'Batal',
    save: 'Simpan',
    offline: 'Menampilkan data tersimpan. Sambungkan internet untuk yang terbaru.',
  },

  // BARU di v2.0
  auth: {
    loginTitle: 'Masuk ke SIGAP',
    loginSubtitle: 'Kami kirim kode enam digit ke email Anda. Tidak perlu kata sandi.',
    emailLabel: 'Alamat email',
    emailPlaceholder: 'nama@email.com',
    emailInvalid: 'Alamat email tidak valid',
    sendCode: 'Kirim Kode',
    sending: 'Mengirim kode ke email Anda...',

    verifyTitle: 'Masukkan enam angka yang kami kirim',
    verifySubtitle: (email: string) => `Kode dikirim ke ${email}. Cek juga folder spam.`,
    changeEmail: 'Ganti email',
    openMailApp: 'Buka aplikasi email',
    verify: 'Masuk',
    verifying: 'Memeriksa kode...',
    resend: 'Kirim ulang kode',
    resendIn: (s: number) => `Kirim ulang kode dalam ${s} detik`,

    codeInvalid: 'Kode salah atau sudah kedaluwarsa. Coba kirim ulang.',
    tooManyAttempts: 'Terlalu banyak percobaan. Minta kode baru.',
    rateLimited: (s: number) => `Tunggu ${s} detik sebelum meminta kode lagi.`,
    emailFailed: 'Gagal mengirim email. Periksa alamatnya lalu coba lagi.',
    accountDisabled: 'Akun ini dinonaktifkan. Hubungi kantor kelurahan Anda.',
    sessionExpired: 'Sesi Anda berakhir. Silakan masuk kembali.',

    signOut: 'Keluar',
    signOutAll: 'Keluar dari semua perangkat',
    devices: 'Perangkat yang sedang masuk',
  },

  report: {
    title: 'Ada masalah apa?',
    subtitle: 'Foto dulu, sisanya kami bantu isi.',
    photoCta: 'Ambil Foto',
    descriptionPlaceholder: 'Contoh: Jalan berlubang besar di depan SD Sukamaju, '
      + 'berbahaya untuk pengendara motor.',
    submit: 'Kirim Laporan',
    submitting: 'Mengirim laporan Anda...',
    tooShort: 'Ceritakan lebih detail, minimal 20 karakter',
    noPhoto: 'Wajib melampirkan minimal satu foto',
    noLocation: 'Lokasi belum didapat. Aktifkan izin lokasi lalu coba lagi.',
    aiPending: 'Laporan Anda sudah kami terima. Petugas akan memeriksanya secara manual.',
    aiDone: (dinas: string) => `Laporan Anda diteruskan ke ${dinas}.`,
  },

  duplicate: {
    title: 'Sepertinya sudah ada yang melaporkan',
    subtitle: 'Mendukung laporan yang ada membuatnya lebih cepat ditangani '
      + 'daripada membuat laporan baru.',
    support: 'Dukung laporan ini',
    createAnyway: 'Tetap kirim laporan baru',
  },

  sla: {
    remaining: (t: string) => `Target penanganan ${t} lagi`,
    overdue: (t: string) => `Terlambat ${t} dari target`,
    onTime: 'Selesai tepat waktu',
  },

  empty: {
    feed: { title: 'Belum ada laporan di sekitar sini',
            message: 'Jadilah warga pertama yang melaporkan masalah di kelurahan Anda.',
            action: 'Buat Laporan' },
    aspirasi: { title: 'Belum ada usulan di kelurahan Anda',
                message: 'Usulan Anda bisa menjadi mata anggaran tahun depan.',
                action: 'Buat Usulan' },
  },

  error: {
    network: 'Koneksi sedang terganggu.',
    session: 'Sesi Anda berakhir. Silakan masuk kembali.',
    permissionCamera: 'SIGAP butuh izin kamera untuk memotret bukti aduan.',
    permissionLocation: 'SIGAP butuh izin lokasi untuk menandai titik aduan di peta.',
  },
} as const;
```

## 10.3 Aturan penulisan

- **Kalimat aktif.** "Petugas sedang menangani", bukan "Sedang ditangani oleh petugas".
- **Sebut pelakunya.** "Dinas Perhubungan sudah menerima laporan Anda" lebih menenangkan daripada "Laporan diteruskan".
- **Pesan kesalahan selalu memuat dua hal:** apa yang terjadi, dan apa yang bisa dilakukan pengguna.
- **Jangan meminta maaf berlebihan.** Satu kali "Maaf" cukup; sisanya jelaskan langkah berikutnya.
- **Angka waktu dalam bahasa manusia:** "2 hari lagi", bukan "48 jam" atau "2026-08-11T09:00Z".
- **Tidak ada tanda seru** di pesan sistem, kecuali pada notifikasi darurat.
- **Jangan pernah menyebut nama layanan pihak ketiga kepada warga.** Bukan "Resend gagal mengirim", melainkan "Gagal mengirim email". Warga tidak perlu tahu vendor kita, dan menyebutnya hanya membuat pesan terasa seperti kesalahan orang lain.

---

# 11 · Error, Offline & Empty State

## 11.1 Matriks penanganan kegagalan

| Kegagalan | Yang dilihat pengguna | Yang dilakukan sistem |
|---|---|---|
| Tidak ada koneksi saat membuka feed | Data terakhir dengan bilah "Menampilkan data tersimpan" | React Query menyajikan cache; muat ulang otomatis saat koneksi kembali |
| Tidak ada koneksi saat mengirim aduan | "Koneksi terganggu. Laporan Anda tersimpan dan akan dikirim otomatis." | Simpan draf di AsyncStorage; kirim ulang saat koneksi kembali |
| AI klasifikasi gagal | "Laporan Anda sudah kami terima. Petugas akan memeriksanya secara manual." | Baris tetap `pending_classification`, masuk antrean admin |
| Embedding gagal | Tidak terlihat sama sekali | Kolom `embedding` NULL; deteksi duplikat dilewati; job latar belakang mengisi belakangan |
| Unggah foto gagal | Foto ditandai dengan ikon coba lagi | Foto lain tetap terunggah; aduan dapat dikirim bila minimal satu foto berhasil |
| Izin kamera ditolak | Penjelasan mengapa dibutuhkan + tombol ke Pengaturan | Sediakan jalur alternatif memilih dari galeri |
| Izin lokasi ditolak | Peta dengan pin yang dapat digeser manual | Aduan tetap dapat dikirim dengan koordinat pilihan manual |
| **Reverse geocode gagal** | **Koordinat ditampilkan apa adanya** | **Tetap simpan lat/lng; `location_address` NULL. Bukan penghalang** |
| **Email OTP tidak terkirim** | **"Gagal mengirim email. Periksa alamatnya lalu coba lagi."** | **Kode langsung ditandai terpakai (T11) agar warga tidak terkunci cooldown** |
| **Email masuk folder spam** | **Baris di layar verify: "Cek juga folder spam."** | **Tidak ada yang bisa dilakukan sistem. Domain wajib punya SPF/DKIM/DMARC — lihat 15.4** |
| **Kuota email harian habis** | **"Gagal mengirim email. Coba lagi nanti."** | **Catat ke log sebagai peringatan operasional. Warga yang sudah punya sesi tidak terpengaruh** |
| **Access token kedaluwarsa** | **Tidak terlihat sama sekali** | **`getValidAccessToken()` menyegarkan otomatis sebelum query berjalan** |
| **Refresh token kedaluwarsa/dicabut** | **"Sesi Anda berakhir. Silakan masuk kembali."** | **Bersihkan SecureStore, alihkan ke login, simpan draf yang belum terkirim** |
| **Pemakaian ulang refresh token** | **Sama seperti di atas** | **Cabut SELURUH sesi pengguna itu, catat `revoked_reason = 'reuse_detected'`** |
| RLS menolak operasi | "Anda tidak memiliki izin untuk tindakan ini." | Catat ke log; ini menandakan bug antarmuka yang menampilkan tombol yang seharusnya tersembunyi |

## 11.2 Aturan empty state

Setiap keadaan kosong wajib memuat tiga hal: **ilustrasi atau ikon**, **penjelasan mengapa kosong**, dan **satu aksi yang dapat dilakukan**. Menulis "Tidak ada data" adalah pelanggaran terhadap dokumen ini.

## 11.3 Aturan keadaan memuat

- Muat awal daftar: gunakan skeleton berbentuk kartu, bukan spinner di tengah layar.
- Aksi pengguna (kirim, dukung, vote): ubah label tombol menjadi keadaan proses dan nonaktifkan tombol.
- Proses lebih dari 3 detik: tambahkan teks yang menjelaskan tahapannya, misalnya "Menghubungi Dinas Pekerjaan Umum...".
- Optimistic update dipakai untuk dukungan dan vote — angka naik seketika, dikembalikan bila server menolak.
- **Penyegaran token tidak pernah menampilkan indikator apa pun.** Ia berjalan di balik layar; warga tidak boleh tahu ia sedang terjadi.

---

# 12 · Testing & Definition of Done

## 12.1 Piramida pengujian

| Lapisan | Alat | Yang diuji |
|---|---|---|
| Unit — mayoritas | Vitest | Token tema, skema Zod, perhitungan SLA, perhitungan poin, format rupiah, format tanggal, **normalisasi email** |
| Unit Deno | `deno test` | Klien Groq (timeout, retry, tanpa key), **klien Resend**, **generateOtp / hashOtp / timingSafeEqual**, **signAccessToken / verifyAccessToken**, `parseClassification`, `computeSlaDueAt` |
| Integrasi database | `psql` + Supabase lokal | Policy RLS per peran, trigger sinkronisasi hitungan, fungsi deteksi duplikat, constraint unik, **rate limit OTP**, **indeks unik satu kode aktif** |
| **Integrasi auth** | **Supabase lokal + `curl`** | **Alur OTP ujung ke ujung, rotasi refresh token, deteksi pemakaian ulang, RLS dengan token buatan sendiri** |
| Komponen | React Native Testing Library | Komponen dengan logika keadaan: `SlaCountdown`, `PhotoPicker`, `Timeline`, **`OtpInput`**, **`CooldownButton`** |
| Manual terarah | Perangkat nyata | Alur SOS, izin ditolak, mode pesawat, mode gelap, layar 5 inci, **email masuk di ponsel sungguhan** |

## 12.2 Uji RLS wajib

Setiap policy harus dibuktikan **menolak**, bukan hanya mengizinkan. Contoh berkas `supabase/tests/rls.sql`:

```sql
-- Warga tidak boleh menaikkan perannya sendiri menjadi admin.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111"}';
UPDATE profiles SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';
-- Harapan: 0 baris terpengaruh (policy WITH CHECK menolak).

-- Staf PUPR tidak boleh menyentuh aduan Dinas Lingkungan Hidup.
SET LOCAL request.jwt.claims TO '{"sub":"33333333-3333-3333-3333-333333333333"}';
UPDATE complaints SET status = 'resolved' WHERE assigned_dinas = 'dlh';
-- Harapan: 0 baris terpengaruh.

-- Warga tidak boleh membaca permohonan layanan warga lain.
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT COUNT(*) FROM service_requests
 WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Harapan: 0.

-- Warga tidak boleh menulis poin untuk dirinya sendiri.
INSERT INTO point_ledger (user_id, points, reason)
VALUES ('11111111-1111-1111-1111-111111111111', 9999, 'curang');
-- Harapan: error, tidak ada policy INSERT pada point_ledger.

-- ===== BARU di v2.0 — identitas =====

-- Warga tidak boleh membaca email warga lain.
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT COUNT(*) FROM users WHERE id = '22222222-2222-2222-2222-222222222222';
-- Harapan: 0.

-- Tidak seorang pun dapat menyentuh tabel kode OTP, bahkan untuk membaca.
SELECT COUNT(*) FROM auth_otp_codes;
-- Harapan: 0 baris (RLS aktif tanpa satu pun policy).

-- Warga tidak boleh membaca sesi warga lain.
SELECT COUNT(*) FROM auth_sessions
 WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Harapan: 0.

-- Warga tidak boleh mencabut sesinya lewat UPDATE langsung
-- (harus lewat Edge Function auth-signout).
UPDATE auth_sessions SET revoked_at = NOW()
 WHERE user_id = '11111111-1111-1111-1111-111111111111';
-- Harapan: 0 baris terpengaruh (tidak ada policy UPDATE).
```

## 12.3 Uji auth wajib — BARU di v2.0

```
[Deno] generateOtp mengembalikan tepat enam digit, seribu kali berturut-turut
[Deno] hashOtp menghasilkan hash berbeda untuk pepper berbeda
[Deno] hashOtp melempar error bila OTP_PEPPER tidak diset
[Deno] timingSafeEqual mengembalikan false untuk panjang berbeda tanpa melempar
[Deno] normalizeEmail: '  Budi@Mail.COM ' menjadi 'budi@mail.com'
[Deno] signAccessToken menghasilkan token dengan sub, role=authenticated, aud, exp
[Deno] verifyAccessToken menolak token yang ditandatangani kunci lain
[Deno] verifyAccessToken menolak token kedaluwarsa
[Deno] sendEmail melempar error dan TIDAK retry saat Resend mengembalikan 422
[Deno] sendEmail retry sekali saat Resend mengembalikan 500
[Deno] auth-request-otp tidak pernah memuat devCode saat OTP_DEV_MODE tidak diset

[SQL]  check_otp_rate_limit menolak permintaan kedua dalam 60 detik
[SQL]  check_otp_rate_limit menolak permintaan keempat dalam satu jam
[SQL]  INSERT kode kedua tanpa membatalkan yang pertama melanggar
       auth_otp_one_active_idx
[SQL]  find_or_create_user membuat users + profiles dalam satu transaksi
[SQL]  find_or_create_user memanggil ulang dengan email sama tidak membuat
       baris kedua

[curl] Alur penuh: request → verify → query complaints dengan token hasilnya
[curl] Refresh mengembalikan token baru dan mencabut yang lama
[curl] Memakai refresh token lama sesudah rotasi mencabut seluruh sesi
[curl] Token dengan role='admin' di klaim ditolak PostgREST
[curl] Unggah ke storage folder {user_id} berhasil dengan token buatan sendiri
[curl] Unggah ke folder orang lain ditolak 403
```

> ### SATU TEST YANG PALING MUDAH TERLEWAT
>
> **Refresh paralel.** Jalankan lima query bersamaan dengan `Promise.all` saat access token sudah kedaluwarsa, lalu hitung baris `auth_sessions` yang tercipta. Harapan: **tepat satu** baris baru. Bila hasilnya lima, penjaga `refreshing` di `session.ts` tidak bekerja, dan aplikasi akan mencabut sesi warga secara acak di produksi — bug yang sangat sulit dilacak dari laporan pengguna.

## 12.4 Definition of Done per fitur

| ✓ | Butir |
|---|---|
| ☐ | `pnpm typecheck` lulus di seluruh workspace tanpa error dan tanpa `@ts-ignore` baru. |
| ☐ | `pnpm test` dan `deno test` lulus; test baru benar-benar menguji perilaku. |
| ☐ | Happy path berjalan di perangkat atau emulator nyata. |
| ☐ | Semua jalur kegagalan pada Bagian 11 ditangani untuk fitur ini. |
| ☐ | Mode gelap diperiksa langsung, bukan diasumsikan. |
| ☐ | Tidak ada hex literal, tidak ada ukuran font literal, tidak ada string antarmuka di luar `copy.ts`. |
| ☐ | Setiap elemen yang dapat disentuh memiliki `accessibilityLabel` berbahasa Indonesia. |
| ☐ | Target sentuh minimal 44×44 px; body text minimal 16 px. |
| ☐ | Policy RLS yang relevan diuji **menolak** akses yang tidak berhak. |
| ☐ | **Tidak ada pemakaian `supabase.auth.*` di mana pun.** |
| ☐ | **Fitur tetap berjalan sesudah access token disegarkan** (uji dengan memperpendek TTL sementara). |
| ☐ | Satu commit Conventional Commits, pesan menjelaskan perubahan perilaku, bukan daftar berkas. |

---

# 13 · Rencana Eksekusi per Sprint

Urutan ini bukan saran. Setiap sprint bergantung pada keluaran sprint sebelumnya. Kerjakan berurutan, dan jangan memulai sprint berikutnya sebelum Definition of Done sprint berjalan terpenuhi.

> **Perubahan v2.0:** Sprint 1 menjadi jauh lebih berat karena autentikasi sekarang dibangun sendiri, bukan diwarisi. Jangan mengecilkan porsinya — dua belas task di bawah adalah pekerjaan yang nyata, dan menyelesaikannya dengan benar membuat lima sprint sesudahnya berjalan tanpa kejutan. Autentikasi yang setengah jadi akan muncul lagi sebagai bug misterius di Sprint 2 (Realtime diam), Sprint 5 (SOS gagal), dan Sprint 6 (unggah dokumen ditolak).

| Sprint | Isi | Hasil yang dapat ditunjukkan |
|---|---|---|
| **1** | Monorepo, package shared, Supabase lokal, migrasi 1–7, RLS, **seluruh lapisan autentikasi OTP email**, aplikasi Expo dengan login | Warga dapat masuk dengan email sungguhan, sesi bertahan setelah aplikasi ditutup, seluruh test theme, schema, dan auth lulus |
| **2** | Edge Function `classify-report` + `embed-text`, alur buat aduan, review, duplikat, detail, feed peta | Aduan berjalan ujung ke ujung dengan AI, dari kamera sampai timeline |
| **3** | Dashboard admin Next.js: antrean, verifikasi, koreksi klasifikasi, unggah foto progres, rekap SLA | Petugas dapat benar-benar bekerja; satu siklus aduan selesai penuh |
| **4** | M2 ASPIRASI + voting + periode + M6 gamifikasi, poin, leaderboard, pengumuman | Loop partisipasi berfungsi; leaderboard kelurahan hidup |
| **5** | M3 ANGGARAN + impor CSV + RAG `ask-budget` + M5 DARURAT lengkap | Pembeda utama muncul: transparansi anggaran dan SOS |
| **6** | M4 LAYANAN + OCR, polish menyeluruh, data demo, aksesibilitas, video | Siap dinilai |

## 13.1 Rincian task Sprint 1

| Task | Isi | Verifikasi |
|---|---|---|
| **1.1** | Inisialisasi monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc` | `pnpm install && pnpm turbo --version` mencetak `2.x.x` |
| **1.2** | `packages/shared`: `theme.ts` + test (5 test) | `pnpm vitest run` — 5 lulus |
| **1.3** | `packages/shared`: `constants.ts`, `schemas.ts` (termasuk `emailSchema`, `otpCodeSchema`) + test | `pnpm vitest run` — seluruh test lulus |
| **1.4** | Supabase init + migrasi 1 sampai 7 + seed | `supabase db reset` tanpa error; 8 baris `dinas` dan 5 baris `users` masuk |
| **1.5** | Verifikasi RLS aktif di seluruh tabel | Query `pg_tables` menampilkan `rowsecurity = t` untuk semua; `pg_policies` untuk `auth_otp_codes` mengembalikan 0 baris |
| **1.6** | **Tentukan mode JWT proyek.** Periksa apakah legacy HS256 secret masih aktif atau proyek memakai signing key asimetris | Tulis hasilnya sebagai komentar `// ASUMSI:` di `_shared/jwt.ts`. Buktikan dengan satu token uji yang diterima PostgREST |
| **1.7** | `packages/supabase`: client factory dengan opsi `accessToken` + generate tipe | `pnpm gen:types` lalu `pnpm typecheck` bersih |
| **1.8** | `_shared/jwt.ts` + `_shared/otp.ts` + test Deno | `deno test --allow-env` — 8 test lulus |
| **1.9** | `_shared/resend.ts` + `_shared/email-templates.ts` + test Deno | `deno test --allow-env --allow-net` — 3 test lulus; email uji terkirim ke `delivered@resend.dev` |
| **1.10** | `auth-request-otp` + `auth-verify-otp` + test rate limit | `curl` menghasilkan sesi; permintaan kedua dalam 60 detik ditolak `rate_limited` |
| **1.11** | `auth-refresh` + `auth-signout` + test rotasi | `curl`: refresh berhasil, memakai token lama sesudahnya mencabut seluruh sesi |
| **1.12** | Aplikasi Expo: `app.json`, `supabase.ts`, `session.ts`, `useAuth`, `_layout`, `login`, `verify`, `onboarding`, tabs | Login dengan `OTP_DEV_MODE` berhasil; Beranda muncul dengan nama pengguna; *force stop* lalu buka lagi tidak meminta kode |
| **1.13** | **Bukti integrasi:** unggah storage + langganan Realtime memakai token buatan sendiri | Foto terunggah ke `{user_id}/`; INSERT `complaint_timeline` lewat SQL muncul di layar tanpa muat ulang |

> ### TASK 1.13 ADALAH GERBANG, BUKAN PELENGKAP
>
> Storage dan Realtime adalah dua tempat yang paling mungkin menolak token buatan sendiri, dan keduanya gagal dengan cara yang sunyi — tanpa error yang jelas. Membuktikannya di Sprint 1 jauh lebih murah daripada menemukannya di Sprint 5 saat SOS tidak berbunyi di layar operator dan tidak ada yang tahu sebabnya.

## 13.2 Rincian task Sprint 2

| Task | Isi | Verifikasi |
|---|---|---|
| **2.1** | `_shared/groq.ts` + `cors.ts` + `prompts.ts` + test Deno | `deno test --allow-env --allow-net` — 4 test lulus |
| **2.2** | `embed-text` Edge Function memakai `Supabase.ai.Session('gte-small')` | Panggilan mengembalikan vektor 384 dimensi; kolom `embedding` terisi |
| **2.3** | `classify-report` + test `parseClassification` & `computeSlaDueAt` | `deno test` — 5 test lulus; fungsi dilayani di localhost |
| **2.4** | Storage + `upload.ts` dengan kompresi gambar | Foto terunggah ke `{user_id}/`; percobaan menulis ke folder lain ditolak |
| **2.5** | `useCreateComplaint` + layar `(tabs)/report` | Aduan tersimpan meski Edge Function dimatikan |
| **2.6** | `report/review` + `report/duplicate` | Aduan mirip di radius 500 m memunculkan tawaran dukung |
| **2.7** | `report/[id]` dengan Timeline Realtime + `SlaCountdown` | Mengubah status dari SQL langsung memunculkan entri baru di layar tanpa muat ulang |
| **2.8** | `(tabs)/feed` peta + daftar + filter | Marker berwarna sesuai urgensi; filter kelurahan berfungsi; mengubah filter tidak membuat peta berkedip |

> ### CARA MEMAKAI RENCANA INI BERSAMA AI AGENT
>
> Kerjakan **satu task per percakapan**. Awali dengan menyebut nomor task, lampirkan dokumen ini, dan minta agen menyelesaikan hanya task itu sampai perintah verifikasinya lulus. Menggabungkan beberapa task dalam satu percakapan meningkatkan kemungkinan agen melewatkan langkah verifikasi.

---

# 14 · Prompt Siap Pakai

Blok berikut dapat disalin apa adanya ke AI coding agent (Claude Code, Cursor, Windsurf, atau sejenisnya). Lampirkan dokumen ini bersama prompt-nya.

## 14.1 Prompt pembuka proyek

```
Kamu akan membangun SIGAP, aplikasi partisipasi publik untuk pemerintah
daerah Indonesia, memakai React Native (Expo SDK 51 + Expo Router v3)
dengan Supabase sebagai database dan AI di Groq Cloud.

Dokumen "SIGAP — PRD & AI Build Specification v2.0" terlampir adalah
satu-satunya sumber kebenaran. Baca seluruhnya sebelum menulis kode.

ATURAN YANG MENGIKAT:
1. Ikuti Bagian 2 (Guardrails) tanpa pengecualian.
2. Test dulu: tulis test yang gagal, jalankan, pastikan gagal, baru
   tulis implementasinya.
3. Jangan menambah dependensi di luar Bagian 4.4. Bila merasa butuh,
   tulis "// ASUMSI: ..." dan pilih solusi tanpa paket baru.
4. Semua warna, ukuran font, dan spacing berasal dari @sigap/shared.
   Tidak ada hex literal di folder apps/.
5. Semua string antarmuka berada di apps/mobile/src/i18n/copy.ts,
   berbahasa Indonesia. Nama variabel dan kolom berbahasa Inggris.
6. Otorisasi dijalankan RLS di database, bukan pengecekan di React Native.
7. Data pengguna tidak pernah hilang karena kegagalan AI atau jaringan.
   Simpan dulu, perkaya kemudian.
8. SIGAP TIDAK MEMAKAI SUPABASE AUTH. Autentikasi dibangun sendiri:
   OTP enam digit ke email lewat Resend, sesi memakai JWT yang kita
   tandatangani dengan kunci proyek Supabase. Dilarang memakai
   supabase.auth.* di mana pun. Bagian 4.2 dan 7.6 menjelaskan caranya.

MULAI DARI: Sprint 1 Task 1.1 pada Bagian 13.1.
Kerjakan HANYA task itu. Jalankan perintah verifikasinya, tunjukkan
keluarannya kepada saya, lalu berhenti dan tunggu instruksi berikutnya.

Sebelum mulai, tuliskan ringkasan 5 baris tentang apa yang akan kamu
kerjakan pada task ini agar saya bisa memastikan pemahaman kita sama.
```

## 14.2 Prompt lanjutan per task

```
Lanjutkan ke Task <NOMOR> pada Bagian 13 dokumen SIGAP.

Sebelum menulis kode:
1. Sebutkan berkas apa saja yang akan kamu buat atau ubah.
2. Sebutkan bagian dokumen mana yang menjadi acuannya.
3. Sebutkan perintah verifikasi yang akan kamu jalankan di akhir.

Lalu kerjakan. Jangan menyentuh berkas di luar daftar yang kamu sebutkan.
Akhiri dengan menjalankan perintah verifikasi dan menampilkan keluarannya
apa adanya — termasuk bila gagal.
```

## 14.3 Prompt membangun satu layar

```
Bangun layar <RUTE> sesuai Bagian 9 dokumen SIGAP.

Acuan yang wajib kamu buka:
- Bagian 5.2 dan 5.3 untuk token warna dan tipografi
- Bagian 5.4 untuk komponen yang sudah tersedia — pakai ulang,
  jangan membuat komponen baru yang duplikat
- Bagian 10 untuk seluruh teks antarmuka
- Bagian 11 untuk keadaan error, offline, dan kosong

Persyaratan:
- Mendukung mode terang dan gelap lewat useColorScheme()
- Body text minimal 16px, target sentuh minimal 44x44
- Setiap elemen yang dapat disentuh punya accessibilityLabel bahasa Indonesia
- Semua keadaan ditangani: memuat, kosong, error, offline, izin ditolak
- Tidak ada hex literal, tidak ada string yang ditulis langsung di komponen
- Identitas pengguna diambil dari useAuth(), BUKAN dari supabase.auth.getUser()

Setelah selesai, daftarkan kriteria penerimaan layar ini dari Bagian 9
dan tandai satu per satu mana yang sudah terpenuhi dan mana yang belum.
```

## 14.4 Prompt membangun Edge Function AI

```
Bangun Edge Function <NAMA> sesuai Bagian 7 dokumen SIGAP.

Wajib:
- Pakai _shared/groq.ts yang sudah ada; jangan menulis klien HTTP baru
- Timeout 8000 ms, satu kali retry — sudah tertangani di callGroq
- Verifikasi identitas pemanggil dengan requireUser(req) dari _shared/jwt.ts,
  lalu pastikan ia pemilik data sebelum menulis
- Ekspor fungsi murni (parsing, perhitungan) agar dapat diuji terpisah
- Tulis test Deno untuk fungsi murni tersebut SEBELUM implementasinya
- Kegagalan AI mengembalikan HTTP 200 dengan { ok:false, reason:'ai_unavailable' },
  bukan 500 — dan data pengguna tetap utuh di database

Jalankan: deno test --allow-env --allow-net <path test>
Tampilkan keluarannya.
```

## 14.5 Prompt membangun Edge Function auth

```
Bangun Edge Function <NAMA> sesuai Bagian 7.6 dokumen SIGAP.

Wajib:
- Ikuti daftar langkah bernomor di Bagian 7.6 persis, termasuk urutannya
- Pakai _shared/otp.ts, _shared/jwt.ts, _shared/resend.ts yang sudah ada
- Kode OTP tidak pernah disimpan atau dicatat dalam bentuk terbaca (T10)
- Rate limit dihitung lewat check_otp_rate_limit di database, bukan di
  memori Edge Function (S8)
- Respons untuk email terdaftar dan tidak terdaftar harus identik (S9)
- Kegagalan email menandai kode sebagai terpakai sebelum merespons (T11)
- Refresh token berotasi setiap dipakai; pemakaian ulang mencabut seluruh
  sesi pengguna itu (S10)
- Tulis test Deno untuk fungsi murni SEBELUM implementasinya

Larangan khusus:
- Jangan pernah mengembalikan pesan error dari Resend kepada klien
- Jangan pernah menaruh peran SIGAP di klaim JWT; role selalu 'authenticated'
- Jangan menambahkan devCode ke respons kecuali OTP_DEV_MODE bernilai 'true'

Jalankan: deno test --allow-env --allow-net <path test>
Lalu buktikan dengan curl sesuai contoh di Bagian 9.1.
```

## 14.6 Prompt tinjauan (review)

```
Tinjau kode yang baru saja kamu tulis terhadap dokumen SIGAP.
Periksa satu per satu dan jawab dengan LULUS atau GAGAL beserta
nomor baris bila gagal:

 1. Ada hex literal di folder apps/?
 2. Ada string antarmuka di luar copy.ts?
 3. Ada body text di bawah 16px atau target sentuh di bawah 44px?
 4. Ada jalur di mana data pengguna hilang saat AI atau jaringan gagal?
 5. Ada pengecekan peran yang hanya ada di React Native tanpa policy RLS?
 6. Ada API key, service role key, JWT secret, atau OTP pepper yang bocor
    ke sisi klien?
 7. Ada elemen dapat disentuh tanpa accessibilityLabel?
 8. Ada logika bisnis tanpa test?
 9. Mode gelap sudah benar-benar diperiksa, bukan diasumsikan?
10. Semua kriteria penerimaan di Bagian 9 untuk fitur ini terpenuhi?
11. Ada pemakaian supabase.auth.* yang tersisa?
12. Ada kode OTP yang tercatat di log atau tersimpan tanpa hash?
13. supabase.realtime.setAuth dipanggil setiap kali token berganti?
14. Fitur ini masih berjalan setelah access token kedaluwarsa dan
    disegarkan otomatis?

Perbaiki setiap butir yang GAGAL, lalu jalankan ulang pemeriksaan ini.
```

---

# 15 · Batasan & Non-Goals

## 15.1 Batasan yang disadari

| Batasan | Alasan | Jalan keluar setelah lomba |
|---|---|---|
| **Masuk memakai email, bukan nomor HP** | SMS gateway berbiaya per pesan dan memerlukan kerja sama operator; Resend memberi 3.000 email gratis per bulan | Tambahkan jalur OTP SMS sebagai alternatif. Skema tidak perlu berubah: `profiles.phone` sudah ada, `auth_otp_codes.email` tinggal ditambah kolom `phone` yang nullable |
| **Batas 100 email per hari di tier gratis** | Tier gratis Resend | Naik ke Pro (tanpa batas harian) sebelum sosialisasi publik. Lihat 15.3 |
| **Sesi 30 hari tanpa pengecekan perangkat** | Tidak ada device fingerprinting | Tambahkan pencocokan device fingerprint pada `auth-refresh` |
| **Tidak ada multi-factor untuk peran petugas** | Waktu lomba | Petugas dan admin memakai jalur masuk yang sama dengan warga. Prioritas pertama setelah pilot: wajibkan MFA untuk peran non-`citizen` |
| Data APBD masuk lewat impor CSV manual oleh admin | API SIPD tidak tersedia untuk publik | Integrasi langsung setelah ada MoU; struktur tabel sudah siap |
| Verifikasi identitas memakai OTP email, bukan NIK Dukcapil | Integrasi Dukcapil memerlukan MoU resmi dan tidak dapat diperoleh dalam waktu lomba | Tambah kolom `nik_verified` pada `profiles`; tidak mengubah arsitektur |
| Tanda tangan surat memakai QR verifikasi, bukan sertifikat BSrE | Sertifikat BSrE memerlukan proses instansi | Ganti pembuat PDF; alur permohonan tidak berubah |
| Embedding 384 dimensi, bukan model yang lebih besar | Batas ukuran indeks dan biaya pada tier gratis Supabase | Naikkan dimensi bersamaan dengan peningkatan paket database |
| Notifikasi memakai FCM tanpa fallback SMS | SMS berbiaya per pesan | Tambahkan SMS untuk aduan P0 saja bila anggaran tersedia |

> ### KEJUJURAN TENTANG PILIHAN EMAIL
>
> Untuk sebagian target pengguna — khususnya persona Bu Sri di Bagian 3.1 — OTP email adalah gesekan yang lebih besar daripada OTP SMS. Nomor HP selalu ada di ponsel; alamat email belum tentu diingat, dan aplikasi email belum tentu terpasang.
>
> Yang membuat pilihan ini tetap masuk akal: **biaya nol**, kendali penuh atas isi dan nada email, dan kemungkinan berpindah penyedia tanpa mengubah satu baris pun di aplikasi mobile. Yang membuatnya dapat ditoleransi warga: **sesi 30 hari** — gesekan terjadi sekali sebulan, bukan setiap hari.
>
> Ini keputusan yang sadar akan harganya, bukan keputusan yang berpura-pura tidak punya harga. Bila data pilot menunjukkan konversi login di bawah 90% (metrik di Bagian 1.4), jalur SMS wajib ditambahkan.

## 15.2 Non-goals — jangan dibangun

- **Obrolan langsung warga–petugas.** Memerlukan operator penuh waktu yang tidak tersedia. Timeline dan komentar sudah cukup.
- **Pembayaran retribusi di dalam aplikasi.** Memerlukan integrasi kas daerah dan audit keuangan.
- **Aplikasi terpisah untuk petugas.** Petugas memakai dashboard web; membangun aplikasi kedua menggandakan biaya perawatan.
- **Mode luring penuh.** Cukup cache baca dan antrean kirim untuk aduan. Sinkronisasi dua arah penuh tidak sebanding manfaatnya.
- **Terjemahan bahasa daerah.** Bahasa Indonesia dipahami seluruh target pengguna.
- **Analitik pihak ketiga yang melacak pengguna.** Ini aplikasi layanan publik; data partisipasi warga tidak dikirim ke pihak ketiga.
- **Masuk dengan Google atau Apple.** Menambah SDK, menambah kebijakan privasi, dan menaruh identitas warga di tangan perusahaan asing. OTP email sudah cukup.
- **Kata sandi.** Tidak akan pernah ada. Kata sandi berarti reset kata sandi, kebocoran kata sandi, dan aturan kompleksitas — tiga masalah yang tidak perlu kita punyai.

## 15.3 Batas layanan gratis

| Layanan | Batas gratis | Yang terjadi bila terlampaui |
|---|---|---|
| **Resend** | **3.000 email/bulan, maksimal 100/hari, 1 domain terverifikasi** | **Login baru gagal dengan `email_failed`. Warga yang sudah punya sesi tidak terpengaruh sama sekali. Naik ke Pro (~$20/bulan) menghapus batas harian** |
| Supabase | 500 MB database, 1 GB storage, 50.000 MAU | Foto adalah konsumen terbesar; kompres ke lebar 1280 px dan batasi 5 foto per aduan |
| Groq Cloud | ± 6.000 request/hari, latensi ± 300 ms | Antrekan klasifikasi; aduan tetap tersimpan dengan status `pending_classification` |
| Expo EAS | 30 build/bulan | Gunakan development build lokal untuk iterasi harian |
| Vercel | 100 GB bandwidth | Cukup untuk dashboard internal petugas |
| **Google Maps SDK (mobile)** | **Tanpa batas, tarif nol** | **Tidak ada yang terjadi. SKU peta dinamis mobile memang gratis. Yang berbayar adalah Geocoding, Places, dan Directions — dan SIGAP tidak memakai satu pun** |
| **MapLibre + tile gratis (dashboard)** | **Bergantung penyedia tile** | **Ganti penyedia tile, atau self-host. Kode peta tidak berubah karena MapLibre tidak terikat vendor** |
| Firebase Cloud Messaging | Tanpa batas | — |

> ### MENGHITUNG KUOTA EMAIL DENGAN JUJUR
>
> Batas 100 email per hari terdengar longgar sampai dihitung. Satu warga baru menghabiskan **satu** email untuk mendaftar. Warga yang salah ketik kode dan meminta ulang menghabiskan **dua**. Dengan sesi 30 hari, warga lama praktis tidak menghabiskan apa pun.
>
> Artinya kapasitas harian kita kira-kira **70–90 pendaftaran baru**. Cukup untuk lomba, demo, dan pilot satu kelurahan. **Tidak cukup** untuk hari peluncuran yang diliput media lokal. Naikkan ke tier Pro sebelum tanggal sosialisasi publik, bukan sesudah warga mengeluh tidak bisa masuk.
>
> Batas bulanan 3.000 jauh lebih longgar daripada batas harian 100 — yang akan lebih dulu tersentuh adalah batas harian, dan itu terjadi persis pada hari tersibuk.

## 15.4 Prasyarat operasional email

Tiga hal ini bukan pekerjaan koding, tetapi tanpanya email OTP akan masuk folder spam dan seluruh alur masuk gagal secara sunyi:

1. **Domain terverifikasi di Resend.** Satu domain pada tier gratis. Pakai subdomain khusus, misalnya `mail.sigap.example.id`, agar reputasi email transaksional terpisah dari domain utama.
2. **Rekaman SPF dan DKIM terpasang di DNS.** Resend memberikan nilainya saat verifikasi domain. Tanpa keduanya, Gmail memperlakukan email sebagai mencurigakan.
3. **Rekaman DMARC dengan kebijakan minimal `p=none`.** Ini memungkinkan pemantauan tanpa risiko menjatuhkan email sendiri.

Verifikasi sebelum demo: kirim OTP ke satu alamat Gmail, satu Yahoo, dan satu Outlook. Ketiganya harus masuk kotak masuk, bukan spam. Lakukan ini **sehari sebelum** penilaian, bukan pada pagi harinya.

---

# 16 · Glosarium

| Istilah | Arti dalam konteks SIGAP |
|---|---|
| **APBD** | Anggaran Pendapatan dan Belanja Daerah — anggaran tahunan pemerintah daerah |
| **Dinas** | Satuan kerja pemerintah daerah yang menangani urusan tertentu, misalnya Dinas Pekerjaan Umum |
| **Kelurahan** | Wilayah administratif terkecil di perkotaan; menentukan feed, hak voting, dan leaderboard |
| **Kecamatan** | Wilayah yang membawahi beberapa kelurahan |
| **Musrenbang** | Musyawarah Perencanaan Pembangunan — forum tahunan penentuan prioritas pembangunan |
| **Pagu** | Batas anggaran yang dialokasikan untuk suatu program |
| **Realisasi** | Bagian anggaran yang telah benar-benar dibelanjakan |
| **SLA** | Service Level Agreement — batas waktu penanganan aduan menurut tingkat urgensi dan dinas |
| **P0 / P1 / P2** | Tingkat urgensi: darurat (<24 jam), penting (<72 jam), normal (<7 hari) |
| **RLS** | Row Level Security — mekanisme otorisasi PostgreSQL yang berjalan di database |
| **pgvector** | Ekstensi PostgreSQL untuk menyimpan dan mencari vektor embedding |
| **Embedding** | Representasi numerik makna teks; dipakai untuk deteksi duplikat dan RAG |
| **RAG** | Retrieval Augmented Generation — AI menjawab berdasarkan dokumen yang diambil, bukan ingatan modelnya |
| **Edge Function** | Fungsi serverless Deno yang berjalan di infrastruktur Supabase; tempat menyimpan API key |
| **SKTM** | Surat Keterangan Tidak Mampu — dokumen untuk mengakses bantuan sosial |
| **Satpol PP** | Satuan Polisi Pamong Praja — penegak peraturan daerah |
| **PDAM** | Perusahaan Daerah Air Minum |
| **OTP** | One Time Password — kode sekali pakai. Di SIGAP dikirim lewat **email**, bukan SMS |
| **Resend** | Penyedia API pengiriman email transaksional yang dipakai SIGAP |
| **JWT** | JSON Web Token — token sesi yang ditandatangani, diverifikasi PostgREST untuk menjalankan RLS |
| **Access token** | JWT berumur 1 jam yang menyertai setiap query. Disimpan di memori saja |
| **Refresh token** | 32 byte acak berumur 30 hari untuk memperoleh access token baru. Disimpan di SecureStore, berotasi setiap dipakai |
| **Rotasi token** | Menerbitkan refresh token baru dan mencabut yang lama setiap kali dipakai, agar pencurian token terdeteksi |
| **Pepper** | String rahasia yang dicampurkan sebelum hashing, disimpan di secrets — bukan di database. Berbeda dari salt, yang disimpan bersama datanya |
| **PostgREST** | Lapisan yang mengubah query `supabase-js` menjadi query PostgreSQL dan memverifikasi JWT |
| **MapLibre** | Pustaka peta sumber terbuka berlisensi BSD, dipakai di dashboard admin |

---

**SIGAP — PRD & AI Build Specification · Versi 2.0 · 10 Agustus 2026**

Dokumen ini adalah sumber kebenaran tunggal untuk pembangunan SIGAP. Perubahan pada spesifikasi wajib dicatat di sini terlebih dahulu, sebelum kode diubah.
