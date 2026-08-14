-- RPC untuk halaman "Ringkasan" dashboard staf (PRD 8.3) — tiga fungsi
-- SECURITY DEFINER yang menentukan cakupannya SENDIRI dari sesi pemanggil
-- (lookup `profiles` via `auth.uid()`), sama persis dengan pola
-- `current_role_name()`/`current_dinas_id()` di 20260810000006_rls.sql —
-- BUKAN dari parameter yang dikirim klien. `p_kelurahan`/`p_dinas_id`
-- sempat diteruskan sebagai argumen eksplisit di revisi pertama migrasi
-- ini, tapi itu membiarkan pemanggil mengklaim cakupan siapa pun (mis.
-- dinas_staff meminta dinas lain) — cakupan sekarang WAJIB berasal dari
-- baris `profiles` milik pemanggil sendiri, tidak bisa dipalsukan dari
-- klien. `get_pending_decisions` tetap menerima `p_kelurahan` sebagai
-- parameter karena cakupannya memang selalu per-kelurahan dari desain
-- awal (bukan hasil derivasi peran), bukan celah otorisasi yang sama.

-- ===== get_ringkasan_stats =====
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
  -- Transisi pertama menjadi 'verified' per aduan — dipakai untuk
  -- avg_response_hours (bukan waktu sampai selesai, itu SLA countdown
  -- terpisah di packages/shared/src/sla.ts getSlaStatus).
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
    -- dengan getSlaStatus().isCritical di packages/shared/src/sla.ts —
    -- perubahan threshold di sana WAJIB dicerminkan di sini juga.
    (SELECT COUNT(*) FROM scoped
       WHERE status IN ('pending_classification', 'pending', 'verified')
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

-- ===== get_sla_compliance_daily =====
CREATE OR REPLACE FUNCTION get_sla_compliance_daily(p_days INT DEFAULT 7)
RETURNS TABLE (
  day DATE,
  compliance_percent NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
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
      AND CASE
        WHEN caller.role IN ('dinas_staff', 'dinas_head') THEN c.assigned_dinas = caller.dinas_id
        WHEN caller.kelurahan IS NOT NULL THEN c.kelurahan = caller.kelurahan
        ELSE TRUE
      END
  )
  SELECT
    d.day,
    -- NULLIF membuat pembagi 0 jadi NULL alih-alih error/0 — hari tanpa
    -- aduan selesai memang harus tampil kosong, bukan 0% yang menyesatkan.
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

-- ===== get_pending_decisions =====
CREATE OR REPLACE FUNCTION get_pending_decisions(p_kelurahan TEXT)
RETURNS TABLE (
  source TEXT,
  ref_id UUID,
  title TEXT,
  subtitle TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'aspirasi' AS source,
    a.id AS ref_id,
    a.title AS title,
    a.vote_count || ' dukungan' AS subtitle,
    a.created_at
  FROM aspirations a
  WHERE a.status = 'musrenbang' AND a.kelurahan = p_kelurahan

  UNION ALL

  SELECT
    'layanan' AS source,
    sr.id AS ref_id,
    -- Label layanan mentah katalog SERVICE_CATALOG (packages/shared/src/constants.ts)
    -- — daftar tetap tujuh jenis, harus tetap sinkron kalau katalog berubah.
    (CASE sr.service_type
      WHEN 'domisili' THEN 'Surat Keterangan Domisili'
      WHEN 'sktm' THEN 'Surat Keterangan Tidak Mampu'
      WHEN 'pengantar_nikah' THEN 'Surat Pengantar Nikah'
      WHEN 'izin_keramaian' THEN 'Surat Izin Keramaian'
      WHEN 'usaha' THEN 'Surat Keterangan Usaha'
      WHEN 'kelahiran' THEN 'Surat Keterangan Kelahiran'
      WHEN 'kematian' THEN 'Surat Keterangan Kematian'
      ELSE sr.service_type
    END) || ' — ' || p.full_name AS title,
    (CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - sr.created_at)) >= 86400
        THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - sr.created_at)) / 86400)::text || ' hari menunggu'
      ELSE GREATEST(FLOOR(EXTRACT(EPOCH FROM (NOW() - sr.created_at)) / 3600), 0)::text || ' jam menunggu'
    END) AS subtitle,
    sr.created_at
  FROM service_requests sr
  JOIN profiles p ON p.id = sr.user_id
  WHERE sr.status = 'verifying' AND p.kelurahan = p_kelurahan

  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_pending_decisions(TEXT) TO authenticated;
