# Supabase Client & Queries

Package untuk klien SIGAP yang berbicara ke PostgREST, Realtime, dan Storage, serta query domain yang digunakan aplikasi mobile dan dashboard.

## Language

**Sesi SIGAP**: Sesi yang dikelola sendiri melalui OTP email dan JWT yang ditandatangani Edge Function; tidak memakai Supabase Auth.
_Avoid_: sesi Supabase, supabase.auth.

**Access Token**: JWT berumur 1 jam yang dibawa setiap query; disimpan di memori aplikasi.
_Avoid_: token akses (hanya terjemahan).

**Refresh Token**: Token acak berumur 30 hari untuk memperoleh access token baru; disimpan di SecureStore dan berotasi setiap dipakai.
_Avoid_: token segar (hanya terjemahan).

**Service Role**: Kunci yang melewati RLS, hanya dipakai di dalam Edge Function.
_Avoid_: admin key, anon key.

**RLS**: Row Level Security — otorisasi di database PostgreSQL.
_Avoid_: otorisasi aplikasi.

**Policy**: Aturan RLS yang membatasi baris mana yang dapat dibaca atau diubah oleh sebuah peran.
_Avoid_: izin (terlalu umum).
