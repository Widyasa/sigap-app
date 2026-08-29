-- =====================================================================
-- Perbaikan kebenaran data hasil audit QA (Agustus 2026).
-- Tidak ada fitur baru; setiap blok memperbaiki angka atau riwayat yang
-- selama ini salah ditampilkan ke warga maupun petugas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. `kelurahan_leaderboard.total_points` menggelembung karena fan-out JOIN.
--
-- Matview lama menggabungkan `complaints` DAN `point_ledger` ke `profiles`
-- dalam satu SELECT. `COUNT(DISTINCT c.id)` aman dari perkalian baris, tapi
-- `SUM(pl.points)` tidak: setiap baris ledger ikut terduplikasi sebanyak
-- jumlah aduan milik warga itu. Warga dengan 3 aduan dan 95 poin menyumbang
-- 3 x 95 = 285 poin ke kelurahannya, sehingga peringkat kelurahan sebenarnya
-- diurutkan berdasarkan poin yang dibobot jumlah laporan — dan angkanya
-- berbeda dari `citizen_leaderboard` (join tunggal) untuk orang yang sama.
--
-- Kedua cabang kini diagregasi lebih dulu, jadi tiap warga menyumbang tepat
-- satu baris. `role = 'citizen'` ditambahkan supaya akun petugas tidak ikut
-- terhitung sebagai warga, konsisten dengan `citizen_leaderboard`.
DROP MATERIALIZED VIEW IF EXISTS kelurahan_leaderboard CASCADE;

CREATE MATERIALIZED VIEW kelurahan_leaderboard AS
  WITH complaint_stats AS (
    SELECT user_id,
           COUNT(*) AS report_count,
           COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count
    FROM complaints
    GROUP BY user_id
  ),
  point_stats AS (
    SELECT user_id, SUM(points) AS points
    FROM point_ledger
    GROUP BY user_id
  )
  SELECT p.kelurahan,
         p.kecamatan,
         COUNT(*)                                   AS citizen_count,
         COALESCE(SUM(cs.report_count), 0)::BIGINT  AS report_count,
         COALESCE(SUM(cs.resolved_count), 0)::BIGINT AS resolved_count,
         COALESCE(SUM(ps.points), 0)::BIGINT        AS total_points
  FROM profiles p
  LEFT JOIN complaint_stats cs ON cs.user_id = p.id
  LEFT JOIN point_stats     ps ON ps.user_id = p.id
  WHERE p.kelurahan IS NOT NULL AND p.role = 'citizen'
  GROUP BY p.kelurahan, p.kecamatan;

CREATE UNIQUE INDEX kelurahan_leaderboard_idx
  ON kelurahan_leaderboard (kelurahan, kecamatan);

GRANT SELECT ON kelurahan_leaderboard TO authenticated;

-- `DROP ... CASCADE` di atas ikut menghapus fungsi yang bergantung padanya,
-- jadi `refresh_leaderboard` dibuat ulang (tetap dengan penjagaan admin dari
-- 20260816000002_security_hardening.sql).
CREATE OR REPLACE FUNCTION refresh_leaderboard() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_role_name() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menyegarkan papan peringkat'
      USING ERRCODE = '42501';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY kelurahan_leaderboard;
END; $$;

GRANT EXECUTE ON FUNCTION refresh_leaderboard() TO authenticated;


-- ---------------------------------------------------------------------
-- 2. Batas hari memakai UTC, padahal penggunanya di WIB/WITA.
--
-- PostgREST terhubung dengan `TimeZone = UTC`, sehingga `created_at::date =
-- CURRENT_DATE` memotong hari di UTC. Antara 00:00 dan 07:00 WIB, tanggal
-- server masih kemarin: kartu "Aduan baru hari ini" menunjukkan 0 sepanjang
-- pagi lalu melompat, dan batang grafik kepatuhan SLA bergeser satu hari
-- untuk apa pun yang selesai sebelum jam 07:00.
CREATE OR REPLACE FUNCTION get_ringkasan_stats()
RETURNS TABLE (
  today_count INT,
  pending_response_count INT,
  pending_near_sla_count INT,
  resolved_week_count INT,
  resolved_last_week_count INT,
  avg_response_hours NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Jakarta'
AS $$
  WITH caller AS (
    SELECT role, dinas_id, kelurahan FROM profiles WHERE id = auth.uid()
  ),
  scoped AS (
    SELECT c.*
    FROM complaints c, caller
    WHERE CASE
      WHEN caller.role IN ('dinas_staff', 'dinas_head') THEN c.assigned_dinas = caller.dinas_id
      WHEN caller.kelurahan IS NOT NULL THEN c.kelurahan = caller.kelurahan
      ELSE TRUE
    END
  ),
  first_verified AS (
    SELECT DISTINCT ON (ct.complaint_id) ct.complaint_id, ct.created_at
    FROM complaint_timeline ct
    WHERE ct.event_type = 'verified'
    ORDER BY ct.complaint_id, ct.created_at ASC
  )
  SELECT
    (SELECT COUNT(*) FROM scoped WHERE created_at::date = CURRENT_DATE)::INT AS today_count,
    (SELECT COUNT(*) FROM scoped
       WHERE status IN ('pending_classification', 'pending', 'verified'))::INT AS pending_response_count,
    -- Kritis = lewat batas ATAU sisa waktu < 20% durasi total, sama persis
    -- dengan getSlaStatus().isCritical di packages/shared/src/sla.ts.
    -- `in_progress` IKUT dihitung: aduan yang sedang dikerjakan justru yang
    -- paling mungkin melewati tenggat, tapi dulu tidak pernah menyalakan
    -- peringatan "mendekati batas SLA" walaupun tabel di bawahnya sudah
    -- menandainya merah.
    (SELECT COUNT(*) FROM scoped
       WHERE status IN ('pending_classification', 'pending', 'verified', 'in_progress')
         AND sla_due_at IS NOT NULL
         AND (
           sla_due_at <= NOW()
           OR EXTRACT(EPOCH FROM (sla_due_at - NOW())) < 0.2 * EXTRACT(EPOCH FROM (sla_due_at - created_at))
         ))::INT AS pending_near_sla_count,
    (SELECT COUNT(*) FROM scoped
       WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '7 days')::INT AS resolved_week_count,
    (SELECT COUNT(*) FROM scoped
       WHERE status = 'resolved'
         AND resolved_at >= NOW() - INTERVAL '14 days'
         AND resolved_at < NOW() - INTERVAL '7 days')::INT AS resolved_last_week_count,
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fv.created_at - s.created_at)) / 3600)::numeric, 1)
       FROM scoped s JOIN first_verified fv ON fv.complaint_id = s.id) AS avg_response_hours;
$$;

GRANT EXECUTE ON FUNCTION get_ringkasan_stats() TO authenticated;

CREATE OR REPLACE FUNCTION get_sla_compliance_daily(p_days INT DEFAULT 7)
RETURNS TABLE (
  day DATE,
  compliance_percent NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Jakarta'
AS $$
  WITH caller AS (
    SELECT role, dinas_id, kelurahan FROM profiles WHERE id = auth.uid()
  ),
  days AS (
    SELECT generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day')::date AS day
  ),
  scoped_resolved AS (
    SELECT c.resolved_at::date AS day, c.resolved_at, c.sla_due_at
    FROM complaints c, caller
    WHERE c.status = 'resolved'
      AND c.resolved_at IS NOT NULL
      -- Aduan tanpa tenggat tidak bisa dinilai patuh atau tidak. Dulu ia
      -- tetap masuk PENYEBUT sementara `resolved_at <= NULL` membuatnya
      -- tak pernah masuk pembilang, sehingga setiap aduan yang selesai
      -- tanpa klasifikasi menekan angka kepatuhan yang dipublikasikan.
      AND c.sla_due_at IS NOT NULL
      AND CASE
        WHEN caller.role IN ('dinas_staff', 'dinas_head') THEN c.assigned_dinas = caller.dinas_id
        WHEN caller.kelurahan IS NOT NULL THEN c.kelurahan = caller.kelurahan
        ELSE TRUE
      END
  )
  SELECT
    d.day,
    ROUND(
      100.0 * COUNT(sr.*) FILTER (WHERE sr.resolved_at <= sr.sla_due_at)
      / NULLIF(COUNT(sr.*), 0), 1
    ) AS compliance_percent
  FROM days d
  LEFT JOIN scoped_resolved sr ON sr.day = d.day
  GROUP BY d.day
  ORDER BY d.day;
$$;

GRANT EXECUTE ON FUNCTION get_sla_compliance_daily(INT) TO authenticated;


-- ---------------------------------------------------------------------
-- 3. Riwayat aduan tidak pernah punya entri "Aduan dibuat".
--
-- `log_complaint_status_change` adalah trigger BEFORE UPDATE, jadi baris
-- pertama di `complaint_timeline` baru muncul saat status BERUBAH. Layar
-- riwayat warga memakai entri pertama sebagai tahap "Laporan terkirim",
-- sehingga aduan yang baru dikirim menampilkan "Laporan terkirim — Belum
-- terjadi" untuk laporan yang jelas-jelas baru saja ia kirim, dan setelah
-- klasifikasi AI tahap itu menampilkan waktu KLASIFIKASI, bukan waktu
-- pengiriman.
CREATE OR REPLACE FUNCTION log_complaint_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO complaint_timeline (complaint_id, actor_id, event_type, note)
  VALUES (NEW.id, NEW.user_id, 'created', NULL);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS complaints_log_created ON complaints;
CREATE TRIGGER complaints_log_created
  AFTER INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION log_complaint_created();

-- Isi mundur untuk aduan yang sudah ada supaya riwayatnya tidak timpang.
INSERT INTO complaint_timeline (complaint_id, actor_id, event_type, note, created_at)
SELECT c.id, c.user_id, 'created', NULL, c.created_at
FROM complaints c
WHERE NOT EXISTS (
  SELECT 1 FROM complaint_timeline t
  WHERE t.complaint_id = c.id AND t.event_type = 'created'
);


-- ---------------------------------------------------------------------
-- 4. Perubahan status oleh dinas harus atomik dengan catatan progresnya.
--
-- Klien sebelumnya melakukan dua panggilan terpisah: UPDATE `complaints`
-- lalu INSERT `complaint_timeline`. Kalau yang kedua gagal (koneksi putus di
-- tengah), aduan sudah tertutup — beserta poin +50 untuk warga dan
-- `resolved_at` yang mengunci angka SLA — sementara catatan dan foto
-- lapangan petugas hilang, dan UI menampilkan "Gagal menyimpan status"
-- sehingga petugas mengira tidak ada yang tersimpan.
--
-- Transisi juga ditegakkan di sini: RLS `complaints_dinas_update` hanya
-- memeriksa SIAPA yang menulis, bukan KE STATUS APA, jadi dinas bisa
-- memindahkan aduannya sendiri ke status mana pun.
CREATE OR REPLACE FUNCTION dinas_update_complaint_status(
  p_complaint_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_photo_urls TEXT[] DEFAULT '{}'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role := current_role_name();
  v_current TEXT;
  v_assigned TEXT;
BEGIN
  IF v_role NOT IN ('dinas_staff', 'dinas_head', 'admin') THEN
    RAISE EXCEPTION 'Peran Anda tidak berhak menindaklanjuti aduan.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('in_progress', 'resolved') THEN
    RAISE EXCEPTION 'Status tindak lanjut hanya boleh in_progress atau resolved.'
      USING ERRCODE = '22023';
  END IF;

  SELECT status, assigned_dinas INTO v_current, v_assigned
  FROM complaints WHERE id = p_complaint_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Aduan tidak ditemukan.' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'admin' AND v_assigned IS DISTINCT FROM current_dinas_id() THEN
    RAISE EXCEPTION 'Aduan ini bukan tanggung jawab dinas Anda.' USING ERRCODE = '42501';
  END IF;

  -- verified -> in_progress -> resolved. Tetap di status yang sama diizinkan
  -- supaya petugas bisa menambah catatan progres tanpa memajukan status.
  IF NOT (
    (v_current = 'verified'    AND p_status IN ('in_progress')) OR
    (v_current = 'in_progress' AND p_status IN ('in_progress', 'resolved'))
  ) THEN
    RAISE EXCEPTION 'Transisi status tidak sah: % -> %', v_current, p_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE complaints SET status = p_status WHERE id = p_complaint_id;

  INSERT INTO complaint_timeline (complaint_id, actor_id, event_type, note, photo_urls)
  VALUES (
    p_complaint_id,
    auth.uid(),
    CASE WHEN p_status = 'resolved' THEN 'resolved' ELSE 'in_progress' END,
    p_note,
    COALESCE(p_photo_urls, '{}')
  );
END; $$;

GRANT EXECUTE ON FUNCTION dinas_update_complaint_status(UUID, TEXT, TEXT, TEXT[]) TO authenticated;
