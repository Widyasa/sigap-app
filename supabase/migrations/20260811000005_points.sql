-- ===== M6 INFO & KOMUNITAS: pengisi otomatis point_ledger (issue #13) =====
--
-- `point_ledger` (dan RLS `points_read`, lihat 20260810000006_rls.sql) sudah
-- ada sejak v1.0, tapi tidak ada satu pun jalur yang menulis ke sana — tabel
-- ini kosong di praktik. Komentar lama menyebut "ditulis oleh Edge Function
-- memakai service role key", tapi tidak ada Edge Function semacam itu di
-- kodebase. Alih-alih menambah Edge Function baru, poin ditulis lewat
-- trigger SECURITY DEFINER di titik kejadian (created/verified/resolved/
-- rejected/upvote/musrenbang) — sama pola dengan `sync_upvote_count()` /
-- `sync_vote_count()` (20260810000010_fix_vote_triggers_rls.sql): trigger
-- perlu SECURITY DEFINER karena `point_ledger` sengaja TIDAK punya policy
-- INSERT untuk role manapun, dan baris yang ditulis sering bukan milik
-- pemanggil (mis. verifikator menulis poin ke akun warga).
--
-- Jejak audit: `report_false` (-35) BUKAN pembalikan aritmetika dari
-- `report_created` (+10) — ini penalti berdiri sendiri (lihat
-- packages/shared/src/constants.ts POINT_REASONS). Baris `report_created`
-- yang asli TIDAK PERNAH diubah atau dihapus; pembatalan hanya menambah
-- baris baru dengan `ref_table`/`ref_id` yang sama, sehingga riwayat lama
-- + pembatalannya tetap terlihat berdampingan (lihat
-- getMyPointLedger/PointLedgerEntry di packages/supabase, dikelompokkan per
-- ref_id di UI).

-- ---------- complaints: dibuat -> +10 ----------
CREATE OR REPLACE FUNCTION award_points_complaint_created() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO point_ledger (user_id, points, reason, ref_table, ref_id)
  VALUES (NEW.user_id, 10, 'report_created', 'complaints', NEW.id);
  RETURN NULL;
END; $$;

CREATE TRIGGER complaints_award_created
  AFTER INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION award_points_complaint_created();

-- ---------- complaints: transisi status -> verified/resolved/rejected ----------
-- Guard `NEW.status IS DISTINCT FROM OLD.status` meniru
-- `log_complaint_status_change()`. Ditambah `NOT EXISTS` per
-- (ref_table, ref_id, reason): status TIDAK BISA mundur lewat UI manapun
-- (verify.tsx hanya maju pending->verified->in_progress->resolved, atau
-- ->rejected), jadi transisi ganda ke status yang sama harusnya mustahil —
-- tapi NOT EXISTS dijaga agar re-run/replay data (mis. migrasi ulang,
-- retry jaringan yang mengulang UPDATE yang sama) tidak pernah
-- menggandakan poin, tanpa perlu tabel state tambahan.
CREATE OR REPLACE FUNCTION award_points_complaint_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason TEXT;
  v_points INT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'verified' THEN
      v_reason := 'report_verified'; v_points := 25;
    ELSIF NEW.status = 'resolved' THEN
      v_reason := 'report_resolved'; v_points := 50;
    ELSIF NEW.status = 'rejected' THEN
      v_reason := 'report_false'; v_points := -35;
    END IF;

    IF v_reason IS NOT NULL THEN
      INSERT INTO point_ledger (user_id, points, reason, ref_table, ref_id)
      SELECT NEW.user_id, v_points, v_reason, 'complaints', NEW.id
      WHERE NOT EXISTS (
        SELECT 1 FROM point_ledger
        WHERE ref_table = 'complaints' AND ref_id = NEW.id AND reason = v_reason
      );
    END IF;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER complaints_award_status
  AFTER UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION award_points_complaint_status();

-- ---------- complaint_upvotes: dibuat -> +2 untuk PEMBERI upvote ----------
CREATE OR REPLACE FUNCTION award_points_upvote() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO point_ledger (user_id, points, reason, ref_table, ref_id)
  VALUES (NEW.user_id, 2, 'upvote_given', 'complaints', NEW.complaint_id);
  RETURN NULL;
END; $$;

CREATE TRIGGER upvotes_award_points
  AFTER INSERT ON complaint_upvotes
  FOR EACH ROW EXECUTE FUNCTION award_points_upvote();

-- ---------- aspirations: naik ke musrenbang -> +100 ----------
-- `OLD.status <> 'musrenbang'` di WHEN sudah menyaring transisi *masuk*
-- musrenbang; NOT EXISTS tetap dijaga untuk alasan yang sama dengan
-- award_points_complaint_status di atas (replay/retry aman).
CREATE OR REPLACE FUNCTION award_points_aspiration_musrenbang() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO point_ledger (user_id, points, reason, ref_table, ref_id)
  SELECT NEW.user_id, 100, 'aspiration_musrenbang', 'aspirations', NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM point_ledger
    WHERE ref_table = 'aspirations' AND ref_id = NEW.id AND reason = 'aspiration_musrenbang'
  );
  RETURN NULL;
END; $$;

CREATE TRIGGER aspirations_award_musrenbang
  AFTER UPDATE ON aspirations
  FOR EACH ROW
  WHEN (NEW.status = 'musrenbang' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION award_points_aspiration_musrenbang();

-- ---------- kelurahan_leaderboard: pastikan REST bisa membacanya ----------
-- `GRANT SELECT ON ALL TABLES IN SCHEMA public` (20260810000008_grants.sql)
-- berjalan SETELAH matview ini dibuat (20260810000005_functions.sql), dan
-- menurut dokumentasi PostgreSQL "ALL TABLES IN SCHEMA" turut mencakup view
-- & materialized view, jadi ini semestinya sudah tercakup — GRANT eksplisit
-- di sini murni jaga-jaga terhadap version skew image lokal (lihat
-- supabase/LOCAL_DEV.md) dan aman diulang (idempotent).
GRANT SELECT ON kelurahan_leaderboard TO anon, authenticated;

-- `refresh_leaderboard()` SECURITY DEFINER sudah bisa dipanggil siapapun
-- yang punya EXECUTE; operasi ini idempotent & tanpa efek samping ke data
-- pengguna lain (hanya menyegarkan agregat publik), jadi cukup digerbangi
-- di level UI (tombol "Segarkan sekarang" hanya muncul di dashboard admin),
-- bukan di level SQL. GRANT eksplisit karena fungsi baru tidak otomatis
-- executable oleh authenticated (default PUBLIC EXECUTE dicabut di banyak
-- image Postgres modern).
GRANT EXECUTE ON FUNCTION refresh_leaderboard() TO authenticated;
