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
