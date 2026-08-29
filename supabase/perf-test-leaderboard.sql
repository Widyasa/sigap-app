-- =====================================================================
-- Uji performa kriteria penerimaan issue #13:
-- "Leaderboard materialized view refreshes and returns in < 1s for
--  50 kelurahan."
--
-- BUKAN dijalankan otomatis (tidak ada di supabase/migrations/ dan tidak
-- dipanggil `supabase db reset`) — script ini membengkakkan data ratusan
-- baris sintetis yang tidak relevan untuk seed dev/demo harian yang
-- dipakai issue #9-#12 juga. Jalankan manual saat perlu mengukur ulang:
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -f supabase/perf-test-leaderboard.sql
--
-- (sesuaikan host/port dengan [db].port di supabase/config.toml bila beda
-- dari default 54322). Aman dijalankan berulang kali: seluruh data
-- sintetis memakai UUID deterministik di bawah namespace
-- 'dddddddd-....' dan dibersihkan sebelum insert ulang (lihat DELETE di
-- bawah), tidak menyentuh data seed.sql biasa.
-- =====================================================================

\timing on

-- ---------- bersihkan run sebelumnya (idempotent) ----------
DELETE FROM point_ledger  WHERE user_id  IN (SELECT id FROM users WHERE email LIKE 'perf.%@sigap.test');
DELETE FROM complaints    WHERE user_id  IN (SELECT id FROM users WHERE email LIKE 'perf.%@sigap.test');
DELETE FROM profiles      WHERE id       IN (SELECT id FROM users WHERE email LIKE 'perf.%@sigap.test');
DELETE FROM users         WHERE email LIKE 'perf.%@sigap.test';

-- ---------- 50 kelurahan sintetis, gaya penamaan mirip seed.sql ----------
-- (Kelurahan Perf 01 .. Perf 50, tiap kelurahan disebar ke 5 kecamatan
-- sintetis agar GROUP BY punya variasi kardinalitas yang wajar.)
WITH kel AS (
  SELECT gs AS n,
         'Kelurahan Perf ' || LPAD(gs::TEXT, 2, '0') AS kelurahan,
         'Kecamatan Perf ' || LPAD(((gs - 1) / 10 + 1)::TEXT, 2, '0') AS kecamatan
  FROM generate_series(1, 50) AS gs
),
-- ~200 warga per kelurahan -> 10.000 profil, representatif untuk kota
-- berukuran sedang dan cukup untuk membebani agregasi COUNT DISTINCT.
warga AS (
  SELECT kel.n, kel.kelurahan, kel.kecamatan, w AS w
  FROM kel
  CROSS JOIN generate_series(1, 200) AS w
),
new_users AS (
  INSERT INTO users (id, email, email_verified_at)
  SELECT gen_random_uuid(),
         'perf.' || n || '.' || w || '@sigap.test',
         NOW()
  FROM warga
  RETURNING id, email
),
warga_ids AS (
  SELECT warga.n, warga.kelurahan, warga.kecamatan, warga.w, new_users.id
  FROM warga
  JOIN new_users ON new_users.email = 'perf.' || warga.n || '.' || warga.w || '@sigap.test'
),
new_profiles AS (
  INSERT INTO profiles (id, full_name, role, kelurahan, kecamatan)
  SELECT id, 'Warga Perf ' || n || '-' || w, 'citizen', kelurahan, kecamatan
  FROM warga_ids
  RETURNING id
)
SELECT COUNT(*) AS profiles_inserted FROM new_profiles;

-- ---------- ~20 aduan per kelurahan (1000 total), sebagian resolved ----------
WITH sampled AS (
  SELECT p.id AS user_id, p.kelurahan, p.kecamatan,
         ROW_NUMBER() OVER (PARTITION BY p.kelurahan ORDER BY p.id) AS rn
  FROM profiles p
  WHERE p.kelurahan LIKE 'Kelurahan Perf %'
),
picked AS (
  SELECT * FROM sampled WHERE rn <= 20
),
inserted AS (
  INSERT INTO complaints (
    user_id, description, kelurahan, kecamatan,
    location_lat, location_lng, status
  )
  SELECT user_id,
         'Aduan uji performa leaderboard #' || rn,
         kelurahan, kecamatan,
         -6.9 + (random() * 0.2), 107.6 + (random() * 0.2),
         CASE WHEN rn % 3 = 0 THEN 'resolved' ELSE 'pending' END
  FROM picked
  RETURNING id
)
SELECT COUNT(*) AS complaints_inserted FROM inserted;

-- point_ledger baris di atas sudah terisi otomatis lewat trigger
-- `complaints_award_created` (20260811000005_points.sql) untuk tiap INSERT
-- di atas; tambahkan sebaran poin tambahan agar SUM(points) tidak seragam.
WITH picked_users AS (
  SELECT id FROM profiles WHERE kelurahan LIKE 'Kelurahan Perf %'
  ORDER BY id LIMIT 3000
)
INSERT INTO point_ledger (user_id, points, reason)
SELECT id, (ARRAY[2,10,25,50,-35])[1 + (random() * 4)::INT], 'upvote_given'
FROM picked_users;

-- ---------- ukur refresh (perlu unique index -> sudah CONCURRENTLY-aman) ----------
-- CATATAN: `EXPLAIN ANALYZE` TIDAK mendukung `REFRESH MATERIALIZED VIEW`
-- (statement utilitas, bukan query plan-able -- EXPLAIN mengembalikan
-- placeholder "Utility statements have no plan structure" TANPA benar-benar
-- menjalankan refresh-nya). \timing di atas sudah mengukur waktu eksekusi
-- nyata untuk statement polos ini.
REFRESH MATERIALIZED VIEW CONCURRENTLY kelurahan_leaderboard;

-- ---------- ukur select (jalur yang benar-benar dipakai mobile/web) ----------
EXPLAIN ANALYZE SELECT * FROM kelurahan_leaderboard ORDER BY total_points DESC;

-- ---------- sanity check jumlah kelurahan ----------
SELECT COUNT(*) AS kelurahan_count FROM kelurahan_leaderboard
WHERE kelurahan LIKE 'Kelurahan Perf %';

\timing off
