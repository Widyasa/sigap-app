# Audit SIGAP Native App terhadap PRD v2.0

**Repo:** `/mnt/c/Users/widya/Documents/Lomba/sigap-app`  
**Tanggal audit:** 2026-08-29  
**Aplikasi yang diaudit:** `apps/native` (Expo React Native) + backend Edge Function & query package terkait  
**Sumber kebenaran:** `SIGAP-PRD-v2.md`

---

## Ringkasan Eksekutif

Aplikasi native telah mengimplementasikan sebagian besar alur utama M0–M6, tetapi terdapat **deviasi arsitektur dan keamanan** yang signifikan terhadap PRD, terutama di sekitar versi dependensi mayor, format JWT refresh token, penyimpanan access token, dan beberapa fitur yang masih parsial/missing. Berikut adalah ringkasan status modul:

| Modul | Status | Catatan Singkat |
|-------|--------|-----------------|
| M0 Auth | **Partial / Deviasi** | OTP email berfungsi, tapi JWT refresh token bukan random 32-byte, access token tersimpan di SecureStore, endpoint auth mengembalikan 4xx/5xx untuk kegagalan terduga |
| M1 LAPOR | **Implemented / Partial** | Aduan + foto + AI klasifikasi + duplikat + timeline + SLA berjalan, tapi tidak ada layar review AI, tidak ada `realtime.setAuth`, layout tab tidak mengikuti struktur PRD |
| M2 ASPIRASI | **Implemented** | Buat aspirasi, voting per kelurahan, peringkat Musrenbang, jejak dampak ke anggaran berjalan |
| M3 ANGGARAN | **Implemented / Partial** | Treemap, drill-down per dinas, detail item, tanya AI (RAG) berjalan, tapi impor CSV hanya di dashboard web (bukan native) |
| M4 LAYANAN | **Partial** | Katalog, pengajuan, tracking, PDF+QR berjalan, **OCR KTP/KK belum diintegrasikan** |
| M5 DARURAT | **Implemented** | SOS tekan-tahan, GPS, audio 10 detik, antrean prioritas, realtime status berjalan |
| M6 INFO & KOMUNITAS | **Partial** | Pengumuman, leaderboard kelurahan, poin & lencana berjalan, tapi **daftar perangkat aktif + "keluar dari semua perangkat" belum ada** |

### 10 Celah Kritis (Top Critical Gaps)

1. **Versi dependensi mayor menyimpang dari PRD** — Expo SDK 55 (PRD: 51), React Native 0.83 (PRD: 0.74), React 19 (PRD: 18.2). PRD Bagian 4.4 melarang menaikkan versi mayor karena risiko inkompatibilitas.
2. **Refresh token diimplementasikan sebagai JWT**, bukan 32-byte random token seperti yang dipersyaratkan PRD Bagian 7.6/S10. JWT refresh token tetap dapat diverifikasi tanpa DB dan tidak sepenuhnya aman terhadap pencabutan.
3. **Access token disimpan di SecureStore** (`session.ts`), sedangkan PRD S11 mengharuskan access token **hanya di memori**; hanya refresh token yang boleh di SecureStore.
4. **Tidak ada pemanggilan `supabase.realtime.setAuth()`** setelah token refresh. PRD Bagian 7.6 secara eksplisit menyatakan ini wajib agar langganan timeline (M1) dan antrean SOS (M5) tidak diam setelah access token kedaluwarsa.
5. **Endpoint auth mengembalikan status 4xx/5xx** untuk kegagalan terduga (mis. `401` untuk `session_expired`, `429` untuk rate limit, `502` untuk email gagal). PRD Bagian 7.2 mengharuskan seluruh kegagalan terdupa diwakili dengan HTTP 200 + `{ ok: false, reason: ... }`.
6. **OCR KTP/KK (M4) belum diintegrasikan di aplikasi native** — `layanan/new.tsx` hanya mengumpulkan foto dan isian manual; `runOcr` tidak pernah dipanggil di `apps/native`.
7. **Tidak ada layar `report/review` dan `report/duplicate` yang didedikasikan**. PRD Bagian 9.2 mensyaratkan layar konfirmasi AI dan layar penawaran duplikat; yang ada hanyalah `Alert` sederhana setelah submit.
8. **Email OTP tidak mengikuti template PRD** — tidak ada subjek berisi kode, tidak ada versi teks (text/plain), footer dan nada bahasa berbeda, dan kegagalan email menghapus baris OTP daripada menandai `consumed_at` seperti yang dipersyaratkan T11.
9. **Layar profil belum menampilkan daftar perangkat aktif dan tombol "Keluar dari semua perangkat"**. PRD M6 kriteria penerimaan no. 6 memerlukan pencabutan seluruh `auth_sessions` dari UI profil.
10. **`classify-report` memanggil Gemini**, bukan Groq `llama-3.3-70b-versatile` seperti yang dipersyaratkan PRD Bagian 7.1/9.2. Ini mengubah penyedia AI tanpa mengubah kontrak, tetapi menyimpang dari spesifikasi.

---

## Audit per Modul

### M0 · AUTH (OTP email, onboarding, session management)

#### PRD Requirements Summary
- Login hanya dengan email, tanpa kata sandi.
- OTP 6 digit dikirim lewat Resend, berlaku 10 menit, max 5 salah, cooldown 60 detik.
- Sesi custom: access token JWT 1 jam (di memori), refresh token 32-byte random 30 hari (di SecureStore), rotasi setiap dipakai.
- JWT ditandatangani sendiri dengan `SUPABASE_JWT_SECRET`, klaim `role` harus `authenticated` (bukan peran domain SIGAP).
- Onboarding: nama, kecamatan, kelurahan; `kelurahan` NULL mengalihkan ke onboarding.
- Keluar dari semua perangkat mencabut seluruh sesi.

#### Existing Implementation
- File native: `apps/native/app/login.tsx`, `verify.tsx`, `onboarding.tsx`, `_components/AuthProvider.tsx`, `_components/session.ts`, `_components/api.ts`, `_components/supabase.ts`.
- Edge Function: `supabase/functions/auth-request-otp`, `auth-verify-otp`, `auth-refresh`, `auth-signout`.
- Shared: `packages/supabase/src/client.ts` (factory `createSigapClient` dengan `accessToken` callback).

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| OTP request via email | Implemented | `auth-request-otp/index.ts` membuat kode, hash, rate limit, kirim via Resend |
| 6-digit OTP input + countdown | Implemented | `OtpInput.tsx`, `verify.tsx` dengan countdown 60 detik |
| OTP cooldown & rate limit | Implemented | `check_otp_rate_limit` RPC, 60s cooldown + 3/jam per email + 10/jam per IP |
| Refresh token rotation | Implemented | `auth-refresh` membuat refresh token baru dan mencabut yang lama |
| Refresh reuse detection | Implemented | `auth-refresh` mencabut seluruh sesi pengguna saat token lama dipakai lagi |
| Custom JWT signing | Implemented | `_shared/jwt.ts` menandatangani HS256 dengan `SUPABASE_JWT_SECRET` |
| Onboarding screen | Implemented | `onboarding.tsx` dengan nama, kecamatan, kelurahan |
| AuthGate redirect to onboarding | Implemented | `AuthProvider.tsx` memeriksa `!user.kelurahan` |
| Sign out current device | Implemented | `AuthProvider.signOut()` memanggil `auth-signout` lalu clear tokens |
| Access token hanya di memori | **Missing** | `session.ts` menyimpan access token di SecureStore (`ACCESS_TOKEN_KEY`) |
| Refresh token sebagai random 32-byte | **Missing** | `_shared/jwt.ts:createRefreshToken` membuat JWT, bukan random hex 32-byte |
| `role` claim minimal (`authenticated` only) | **Partial** | `role` = `authenticated`, tetapi ada tambahan `app_role` (domain role), `email`, `dinas_id`, `kelurahan`, `kecamatan` |
| `aud` claim = `authenticated` | **Missing** | `aud` = `sigap`, bukan `authenticated` |
| Expected failures return 200 ok:false | **Missing** | Endpoint auth mengembalikan `401`, `403`, `429`, `502` |
| Email template sesuai PRD | **Missing** | Subjek tidak berisi kode, tidak ada versi teks, kegagalan menghapus baris (bukan `consumed_at`) |
| Open email app button | Implemented | `verify.tsx` memanggil `Linking.openURL('mailto:...')` |
| Device list + sign out all | **Missing** | `profile.tsx` tidak menampilkan daftar perangkat |

#### Deviations from PRD
1. **Penyimpanan access token**: PRD S11: "Refresh token di perangkat disimpan di `expo-secure-store` ... Access token cukup di memori." Implementasi menyimpan keduanya di SecureStore.
2. **Format refresh token**: PRD Bagian 7.6: "Refresh token: 32 byte acak, hex. Bukan JWT." Implementasi membuat JWT.
3. **Klaim JWT**: PRD S12 membatasi klaim wajib ke `sub, role: 'authenticated', aud: 'authenticated', iat, exp`. Implementasi menambah `app_role` (domain role) yang secara eksplisit dilarang.
4. **Kontrak kegagalan**: PRD Bagian 7.2 semua endpoint `auth-*` bersifat publik dan wajib mengembalikan 200 + `ok:false` untuk rate limit, kode salah, sesi habis, dll.
5. **Email template & kegagalan email**: PRD Bagian 7.4/2.4/T11.

#### Playwright E2E Test Cases for M0
1. Request OTP → masukkan kode → onboarding → buka beranda.
2. Request OTP dua kali dalam 60 detik → tetap di login dengan hitung mundur.
3. Lima kali salah kode → muncul "Terlalu banyak percobaan".
4. Tutup paksa aplikasi setelah login → buka lagi langsung ke beranda tanpa OTP.
5. Ganti email dari layar verify → kembali ke login dengan email terisi.
6. Tekan "Keluar" → aplikasi kembali ke login dan refresh token lama tidak bisa dipakai.
7. Periksa AsyncStorage/SecureStore tidak mengandung access token plaintext.

---

### M1 · LAPOR (Create complaint, AI classification, duplicate detection, timeline, SLA)

#### PRD Requirements Summary
- Buat aduan: foto + deskripsi minimal 20 karakter + GPS.
- Simpan dulu (`pending_classification`) baru panggil AI.
- AI klasifikasi: dinas, kategori, urgensi (P0/P1/P2), judul, ringkasan, confidence; hitung SLA.
- Deteksi duplikat: kemiripan >0.85 dan jarak <500 m; tawarkan dukung laporan yang ada.
- Layar review hasil AI dengan opsi koreksi.
- Detail aduan: timeline realtime, SLA countdown, tombol dukung.
- Feed: peta + daftar + filter.

#### Existing Implementation
- File: `apps/native/app/lapor.tsx`, `feed.tsx`, `aduan/[id].tsx`, `_components/PhotoCarousel.tsx`, `_components/Timeline.tsx`, `SlaCountdown.tsx`, `MapPreview.tsx`, `FeedMap.tsx`.
- Edge Function: `supabase/functions/classify-report`.
- Query: `packages/supabase/src/queries/complaints.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| Create complaint with photo, desc, GPS | Implemented | `lapor.tsx` menggunakan `ImagePicker`, `expo-location`, reverse geocode |
| Save before AI call | Implemented | `createComplaint` dipanggil dulu, baru `classifyComplaint` |
| AI classification (dinas/urgency/title) | Implemented | `classify-report` memanggil AI, update complaints |
| SLA computation | Implemented | `computeSlaDueAt` di `_shared/classification.ts` |
| Duplicate detection (embedding + geo) | Implemented | `find_duplicate_complaints` RPC, ditawarkan lewat `Alert` |
| Timeline display | Implemented | `Timeline.tsx` dengan foto progres |
| Realtime timeline updates | Implemented | `aduan/[id].tsx` subscribe `postgres_changes` pada `complaint_timeline` |
| SLA countdown | Implemented | `SlaCountdown.tsx` |
| Upvote complaint | Implemented | `upvoteComplaint`, `isDuplicateUpvoteError` |
| Feed map + list + filter | Implemented | `feed.tsx` dengan `FeedMap`, filter status, urutan |
| Dedicated `report/review` screen | **Missing** | Hanya `Alert` ringkas; tidak ada layar koreksi AI |
| Dedicated `report/duplicate` screen | **Missing** | Hanya `Alert` konfirmasi dukung |
| `supabase.realtime.setAuth` on token refresh | **Missing** | Tidak ditemukan pemanggilan `setAuth` di seluruh `apps/native` |
| File-based routes PRD `(tabs)/report`, `report/*` | **Missing** | Struktur flat: `lapor.tsx`, `aduan/[id].tsx` |

#### Deviations from PRD
1. Tidak ada layar `report/review` untuk koreksi AI (PRD Bagian 9.2).
2. Tidak ada layar `report/duplicate` dedicated (PRD Bagian 9.2).
3. AI klasifikasi memakai **Gemini** bukan Groq seperti yang dipersyaratkan PRD Bagian 7.1.
4. Tidak ada `realtime.setAuth`, berpotensi membuat langganan timeline mati setelah refresh token.

#### Playwright E2E Test Cases for M1
1. Buat aduan dengan foto + deskripsi + GPS → konfirmasi tersimpan → AI klasifikasi muncul.
2. Matikan Edge Function `classify-report` → buat aduan → aduan tetap tersimpan sebagai `pending_classification`.
3. Kirim aduan di lokasi yang sama dengan aduan sebelumnya → muncul tawaran dukung.
4. Tekan kirim dua kali cepat → hanya satu baris `complaints` yang tercipta.
5. Buka detail aduan → ubah status lewat SQL langsung → timeline realtime muncul.
6. Aduan tanpa foto/tanpa deskripsi minimal 20 karakter tidak bisa dikirim.
7. Dukung aduan → `upvote_count` naik; dukung lagi → muncul pesan sudah mendukung.

---

### M2 · ASPIRASI (Create aspiration, vote per kelurahan, Musrenbang ranking)

#### PRD Requirements Summary
- Warga mengusulkan: apa, lokasi, estimasi penerima manfaat, foto opsional.
- Voting per kelurahan dalam periode aktif; satu warga satu suara.
- Tab kelurahan vs Musrenbang (peringkat kecamatan).
- Detail aspirasi dengan jejak dampak ke mata anggaran.

#### Existing Implementation
- File: `apps/native/app/aspirasi.tsx`, `aspirasi/new.tsx`, `aspirasi/[id].tsx`.
- Query: `packages/supabase/src/queries/aspirations.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| Create aspiration (3 steps) | Implemented | `aspirasi/new.tsx` dengan title, lokasi, estimasi penerima manfaat |
| Voting per kelurahan | Implemented | `voteAspiration`, RLS `votes_insert_own` memeriksa kelurahan |
| Active voting period countdown | Implemented | `aspirasi.tsx` menampilkan countdown periode |
| Musrenbang ranking tab | Implemented | `aspirasi.tsx` tab "Musrenbang" memuat aspirasi per kecamatan |
| Aspiration detail + impact trace | Implemented | `aspirasi/[id].tsx` menampilkan jejak voting → musrenbang → anggaran |
| One vote per user per aspiration | Implemented | Primary key + `isDuplicateVoteError` |
| Vote only in own kelurahan | Implemented | Policy RLS + `isVoteDeniedError` |

#### Deviations from PRD
- Tidak ada deviasi fungsional signifikan. Struktur rute flat (`aspirasi.tsx` vs `(tabs)/aspirasi`) tetap fungsional.

#### Playwright E2E Test Cases for M2
1. Warga kelurahan A mencoba memilih aspirasi kelurahan B → ditolak.
2. Memilih aspirasi sendiri dua kali → muncul pesan sudah memilih.
3. Tutup periode voting → tombol pilih tidak aktif.
4. Buat aspirasi → lihat detail → verifikasi jejak dampak muncul saat status maju.
5. Periksa `vote_count` == jumlah baris `aspiration_votes` setelah pilih/batal.

---

### M3 · ANGGARAN (APBD transparency, drill down per dinas, ask AI RAG)

#### PRD Requirements Summary
- Layar utama: total APBD + treemap per dinas.
- Drill-down: daftar program per dinas.
- Detail proyek: peta, foto progres, kontraktor, pagu vs realisasi.
- Tanya AI (RAG) dengan sumber kutipan.
- Impor CSV oleh admin.

#### Existing Implementation
- File: `apps/native/app/anggaran.tsx`, `anggaran/[dinasId].tsx`, `anggaran/item/[id].tsx`, `anggaran/tanya.tsx`.
- Edge Function: `supabase/functions/ask-budget`.
- Query: `packages/supabase/src/queries/budget.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| APBD total + treemap per dinas | Implemented | `anggaran.tsx` memanggil `listBudgetSummaryBySector` |
| Drill-down per dinas | Implemented | `anggaran/[dinasId].tsx` |
| Budget item detail (map, photos, contractor) | Implemented | `anggaran/item/[id].tsx` |
| Ask AI (RAG) | Implemented | `anggaran/tanya.tsx` memanggil `askBudget` edge function |
| Source citations in RAG answer | Implemented | `AskBudgetCitedItem[]` ditampilkan sebagai kartu sumber |
| CSV import | N/A (native) | Hanya tersedia di dashboard web (`apps/web`) |

#### Deviations from PRD
- Tidak ada deviasi fungsional besar di native. Impor CSV memang di dashboard web sesuai PRD Bagian 9.4.

#### Playwright E2E Test Cases for M3
1. Buka anggaran → verifikasi total pagu dan realisasi sesuai DB.
2. Ketuk kotak dinas → navigasi ke daftar program.
3. Ketuk program → navigasi ke detail dengan peta/foto.
4. Tanya AI: "Berapa anggaran perbaikan jalan di kecamatan X?" → jawaban muncul bersama kartu sumber.
5. Tanya di luar topik anggaran → AI menolak sopan.

---

### M4 · LAYANAN (Service catalog, OCR KTP/KK, PDF + QR verification)

#### PRD Requirements Summary
- Katalog 5 jenis layanan.
- Form + unggah dokumen + OCR KTP/KK mengisi otomatis.
- Tracking status (submitted → verifying → signing → ready → collected).
- PDF output dengan QR verifikasi publik.

#### Existing Implementation
- File: `apps/native/app/layanan.tsx`, `layanan/new.tsx`, `layanan/[id].tsx`, `kartu-warga.tsx`.
- Edge Function: `supabase/functions/ocr-doc`, `generate-service-pdf`.
- Query: `packages/supabase/src/queries/services.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| Service catalog | Implemented | `LayananScreen` dengan `SERVICE_CATALOG` |
| Create service request + upload docs | Implemented | `layanan/new.tsx` mengunggah ke `service-docs` |
| Track status | Implemented | `layanan/[id].tsx` dengan 5 tahap progress |
| PDF + QR verification | Implemented | `generate-service-pdf`, `QrCodeView`, verifikasi publik via RPC |
| OCR KTP/KK auto-fill | **Missing** | `runOcr` tidak dipanggil di `apps/native`; isian surat manual |
| Field confidence <0.8 highlighted | **Missing** | Karena OCR tidak dijalankan |
| Private bucket for docs | Implemented | `service-docs` bucket private, akses via signed URL |

#### Deviations from PRD
1. **OCR tidak diintegrasikan** — ini adalah deviasi besar. PRD Bagian 9.5 mensyaratkan OCR mengisi nama, NIK, alamat, dll secara otomatis.
2. Tidak ada visualisasi confidence OCR karena OCR tidak dipakai.

#### Playwright E2E Test Cases for M4
1. Buka katalog → pilih SKTM → unggah KTP, KK, foto rumah → ajukan.
2. Verifikasi dokumen masuk bucket `service-docs` dan tidak bisa diakses publik tanpa signed URL.
3. Setelah persetujuan petugas, PDF dapat diunduh dan QR mengarah ke halaman verifikasi valid.
4. Warga A tidak bisa membaca permohonan warga B.
5. **(Kritis)** Unggah foto KTP → field NIK/nama terisi otomatis → field dengan confidence <0.8 ditandai kuning.
6. Ajukan permohonan dengan NIK tidak valid → ditolak validasi.

---

### M5 · DARURAT (SOS press-and-hold, GPS + 10s audio, priority queue)

#### PRD Requirements Summary
- Layar merah, tekan & tahan 3 detik.
- Insert alert dulu tanpa AI; rekam 10 detik audio setelahnya.
- Realtime status update, batalkan alert palsu.
- Priority queue untuk operator.

#### Existing Implementation
- File: `apps/native/app/sos.tsx`.
- Query: `packages/supabase/src/queries/emergency.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| SOS press-and-hold 3 detik | Implemented | `Animated.timing` 3 detik, melepaskan sebelum 3 detik membatalkan |
| GPS location | Implemented | `expo-location`, reverse geocode |
| Insert emergency alert immediately | Implemented | `createEmergencyAlert` dipanggil sebelum audio |
| 10s audio recording | Implemented | `expo-audio`, `SOS_AUDIO_DURATION_MS`, `uploadEmergencyAudio` |
| Attach audio after alert created | Implemented | `attachEmergencyAudio` |
| Realtime status | Implemented | Subscribe `emergency_alerts` di `sos.tsx` |
| Cancel false alarm | Implemented | `cancelEmergencyAlert` |
| Priority queue (operator) | Implemented | `listActiveEmergencyAlerts`, `respondToEmergencyAlert` |
| Refresh token before SOS if expired | **Partial** | `getAccessToken` dipanggil via Supabase client, tidak ada pemanggilan eksplisit saat layar dibuka seperti PRD mensyaratkan |

#### Deviations from PRD
1. PRD Bagian 9.6 memerintahkan `getValidAccessToken()` dipanggil **saat layar dibuka**, bukan saat tombol dilepas. Implementasi hanya mengandalkan supabase client yang memanggil `getAccessToken` saat INSERT; meskipun ini berfungsi, tidak sepenuhnya mengikuti spesifikasi.
2. Tidak ada `realtime.setAuth` (sama dengan M1).

#### Playwright E2E Test Cases for M5
1. Tekan & tahan 3 detik → layar konfirmasi <1 detik.
2. Melepas pada 2 detik → tidak ada alert yang terkirim.
3. Kirim SOS → izin mikrofon ditolak → alert tetap tercipta.
4. Matikan semua Edge Function AI → SOS tetap tercipta.
5. Akses token kedaluwarsa saat layar SOS dibuka → refresh berhasil sebelum menekan tombol.
6. Operator merespons → status warga berubah realtime menjadi "responding".
7. Batalkan alert palsu → status menjadi `false_alarm`.

---

### M6 · INFO & KOMUNITAS (Announcements, kelurahan leaderboard, points & badges)

#### PRD Requirements Summary
- Beranda: sapaan, ringkasan laporan, kartu pengumuman, pintasan modul, SOS, peringkat kelurahan.
- Info: daftar pengumuman + kontak dinas.
- Leaderboard kelurahan dan warga.
- Profil: poin, lencana, riwayat poin, daftar perangkat aktif, keluar dari semua perangkat.

#### Existing Implementation
- File: `apps/native/app/home.tsx`, `info.tsx`, `pengumuman.tsx`, `leaderboard.tsx`, `profile.tsx`, `kartu-warga.tsx`.
- Query: `packages/supabase/src/queries/community.ts`.

#### Status
| Feature | Status | Evidence |
|---------|--------|----------|
| Home summary cards + shortcuts + SOS | Implemented | `home.tsx` |
| Announcements list + filters | Implemented | `pengumuman.tsx`, `info.tsx` |
| Kelurahan leaderboard | Implemented | `kelurahan_leaderboard` materialized view, `listLeaderboard` |
| Citizen leaderboard (per RW/filter) | Implemented | `leaderboard.tsx` |
| Points ledger + total | Implemented | `getMyPointLedger`, `getUserTotalPoints` |
| Badges by point thresholds | Implemented | `profile.tsx` |
| Dinas contacts | Implemented | `info.tsx` |
| Mark all as read | Implemented | `markAllAnnouncementsAsRead` |
| Device list + sign out all | **Missing** | `profile.tsx` tidak menampilkan daftar perangkat aktif |
| Real `kartu-warga` data | **Partial** | `kartu-warga.tsx` menggunakan NIK hardcoded dan token random, bukan data profil/service |

#### Deviations from PRD
1. PRD Bagian 9.7 kriteria no. 6 memerlukan daftar perangkat aktif dan tombol "Keluar dari semua perangkat" di profil — belum ada.
2. `kartu-warga.tsx` masih placeholder dengan NIK palsu.

#### Playwright E2E Test Cases for M6
1. Buka beranda → sapaan nama, ringkasan laporan, pengumuman pinned, peringkat kelurahan muncul.
2. Buka info → filter pengumuman, tandai semua dibaca.
3. Leaderboard kelurahan → peringkat kelurahan sendiri disorot.
4. Leaderboard warga → filter RW berfungsi.
5. Profile → total poin = SUM(point_ledger); lencana sesuai threshold.
6. Buat laporan palsu → poin negatif muncul di ledger dan total turun.
7. Login di 2 perangkat → profil menampilkan keduanya; tekan "Keluar dari semua perangkat" → perangkat lain terlempar.

---

## Rekomendasi Prioritas Perbaikan

### Blokir Claim "Semua Fitur Berfungsi"
1. Integrasikan OCR KTP/KK di `layanan/new.tsx` (M4).
2. Tambahkan layar `report/review` dan `report/duplicate` dedicated (M1).
3. Pindahkan access token ke memori saja; hanya refresh token di SecureStore (M0).
4. Ganti refresh token JWT menjadi random 32-byte opaque token (M0).
5. Tambahkan pemanggilan `supabase.realtime.setAuth()` setelah setiap refresh token (M1/M5).
6. Sesuaikan kontrak response auth endpoint ke 200 + `ok:false` untuk kegagalan terduga (M0).
7. Tampilkan daftar perangkat aktif dan tombol "Keluar dari semua perangkat" di profil (M6).

### Perbaikan Sekunder
- Sesuaikan template email OTP dengan PRD (subjek berisi kode, versi teks, kegagalan tandai `consumed_at`).
- Pertimbangkan downgrade versi Expo/React Native ke yang dipersyaratkan PRD, atau dokumentasikan alasan upgrade sebagai ADR.
- Hapus klaim `app_role` dari access token; gunakan RLS `current_role_name()` untuk otoritas.
- Implementasikan `getValidAccessToken()` eksplisit saat layar SOS dibuka.

---

## Catatan Audit

- Audit ini berfokus pada **fitur yang terlihat/dapat diuji** di `apps/native` dan kontrak backend yang langsung disentuhnya. Audit tidak meninjau dashboard web (`apps/web`) kecuali untuk fitur yang bersinggungan dengan native (impor CSV, verifikasi QR publik).
- Beberapa komponen (`MapPreview.web.tsx`, `FeedMap.web.tsx`) menunjukkan dukungan web, tetapi aplikasi utama adalah native.
- Komentar internal di kode (mis. "DULU...") menunjukkan iterasi perbaikan; audit mencatat status terakhir yang terlihat.
