-- ===== Citizen leaderboard (peringkat warga) =====
--
-- `kelurahan_leaderboard` (20260810000005_functions.sql) memberi peringkat
-- ANTAR kelurahan. Halaman "Peringkat warga" butuh peringkat ANTAR warga DI
-- DALAM satu kelurahan (opsional difilter per RW), dengan tiga jendela
-- waktu (minggu/bulan/sepanjang waktu) sekaligus — karena itu sengaja
-- dibuat sebagai VIEW biasa (bukan materialized view seperti
-- kelurahan_leaderboard): jumlah baris per kelurahan jauh lebih kecil
-- (puluhan-ratusan warga, bukan puluhan kelurahan), dan filter RW +
-- window waktu berubah per request sehingga precompute penuh tidak
-- bermanfaat di sini.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rw TEXT;

CREATE OR REPLACE VIEW citizen_leaderboard AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.kelurahan,
  p.kecamatan,
  p.rw,
  COALESCE(SUM(pl.points), 0)::INT AS total_points,
  COALESCE(SUM(pl.points) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '7 days'), 0)::INT AS week_points,
  COALESCE(SUM(pl.points) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '30 days'), 0)::INT AS month_points,
  COUNT(pl.id)::INT AS contribution_count
FROM profiles p
LEFT JOIN point_ledger pl ON pl.user_id = p.id
WHERE p.kelurahan IS NOT NULL AND p.role = 'citizen'
GROUP BY p.id, p.full_name, p.kelurahan, p.kecamatan, p.rw;

-- Sama alasan dengan GRANT eksplisit `kelurahan_leaderboard`
-- (20260811000005_points.sql): jaga-jaga terhadap version skew di image
-- lokal walau `GRANT SELECT ON ALL TABLES IN SCHEMA public` seharusnya
-- sudah mencakup view ini juga.
GRANT SELECT ON citizen_leaderboard TO anon, authenticated;
