-- =====================================================================
-- Pengetatan keamanan hasil audit QA (Agustus 2026).
--
-- Migrasi ini TIDAK menambah fitur. Setiap blok menutup satu jalur akses
-- yang lebih luas daripada yang dibutuhkan aplikasi. Semua perubahan sudah
-- dicek terhadap seluruh pemakaian di `packages/supabase/src/queries/*`,
-- `apps/web`, dan `apps/native` — tidak ada query aplikasi yang bergantung
-- pada akses yang dicabut di sini.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. `anon` tidak boleh membaca tabel apa pun.
--
-- 20260810000008_grants.sql memberi `GRANT SELECT ON ALL TABLES IN SCHEMA
-- public TO anon` dengan asumsi "RLS yang menentukan baris mana". Tapi
-- `profiles_read`, `complaints_read`, `votes_read`, dan `points_read`
-- semuanya `USING (true)`, sehingga siapa pun yang memegang publishable key
-- — yang memang ikut terkirim di bundel aplikasi dan tercatat di
-- apps/native/app.json — bisa mengunduh SELURUH daftar warga (nama,
-- kelurahan, kecamatan, RW) yang di-join ke titik koordinat persis setiap
-- aduan yang mereka buat, tanpa login sama sekali. Untuk kanal pelaporan
-- warga ini berarti pelapor bisa diidentifikasi dan dibalas.
--
-- Satu-satunya jalur anon yang benar-benar dipakai produk adalah halaman
-- publik /verify/[code], dan itu memakai RPC `verify_service_document`
-- (20260811000002) yang GRANT EXECUTE-nya sengaja dipertahankan di bawah.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE SELECT ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT ON SEQUENCES FROM anon;

-- View/matview leaderboard di-GRANT eksplisit ke anon di migrasi lama
-- (20260811000005 dan 20260815000001); `REVOKE ... ON ALL TABLES` sudah
-- mencakupnya, tapi ditulis ulang agar niatnya terbaca jelas.
REVOKE SELECT ON kelurahan_leaderboard FROM anon;
REVOKE SELECT ON citizen_leaderboard FROM anon;

-- Tetap boleh: verifikasi dokumen lewat pemindaian QR oleh siapa pun.
GRANT EXECUTE ON FUNCTION verify_service_document(TEXT) TO anon;


-- ---------------------------------------------------------------------
-- 2. Policy SELECT bertingkat: data pribadi butuh sesi, bukan sekadar
--    publishable key. Ini pertahanan berlapis di belakang blok 1 — kalau
--    GRANT anon suatu saat dikembalikan tanpa sengaja, kebocoran tidak
--    langsung terbuka lagi.
--
-- `dinas`, `budget_items`, `announcements`, dan `voting_periods` sengaja
-- DIBIARKAN publik: itu memang data transparansi tanpa PII.

DROP POLICY IF EXISTS profiles_read ON profiles;
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS complaints_read ON complaints;
CREATE POLICY complaints_read ON complaints FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS timeline_read ON complaint_timeline;
CREATE POLICY timeline_read ON complaint_timeline FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS upvotes_read ON complaint_upvotes;
CREATE POLICY upvotes_read ON complaint_upvotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS aspirations_read ON aspirations;
CREATE POLICY aspirations_read ON aspirations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Kerahasiaan suara: aplikasi hanya pernah membaca suara MILIK SENDIRI
-- (`listMyVotedAspirationIds` selalu `.eq('user_id', userId)`), dan jumlah
-- agregatnya sudah tersedia di `aspirations.vote_count` lewat trigger
-- `sync_vote_count`. Tidak ada alasan siapa pun bisa melihat warga mana
-- memilih usulan mana.
DROP POLICY IF EXISTS votes_read ON aspiration_votes;
CREATE POLICY votes_read ON aspiration_votes FOR SELECT
  USING (user_id = auth.uid() OR current_role_name() IN ('admin','dinas_head'));

-- Sama: `getMyPointLedger` selalu `.eq('user_id', userId)`. Papan peringkat
-- warga tetap jalan karena `citizen_leaderboard` adalah view milik
-- `postgres` (hak pemilik), jadi ia tetap bisa mengagregasi tabel ini.
DROP POLICY IF EXISTS points_read ON point_ledger;
CREATE POLICY points_read ON point_ledger FOR SELECT
  USING (user_id = auth.uid() OR current_role_name() = 'admin');


-- ---------------------------------------------------------------------
-- 3. Warga tidak boleh menyunting baris aduan/aspirasinya sendiri.
--
-- `complaints_owner_update` dan `aspirations_owner_update` membatasi baris
-- LAMA lewat USING, tapi WITH CHECK-nya hanya memeriksa ulang
-- `user_id = auth.uid()` — seluruh kolom lain bebas ditulis. Akibatnya
-- pemilik aduan berstatus 'pending' bisa menyetel `status = 'resolved'`
-- (memicu trigger poin +50 dan mengerek angka kepatuhan SLA yang
-- dipublikasikan), dan pemilik aspirasi bisa menyetel
-- `vote_count = 999999, status = 'musrenbang'` karena `sync_vote_count`
-- hanya berjalan saat baris suara berubah, bukan saat kolomnya ditulis
-- langsung.
--
-- Tidak ada satu pun kode klien yang memakai kedua policy ini: seluruh
-- mutasi aduan lewat `updateComplaintClassification`/`updateComplaintStatus`
-- (petugas), dan mutasi aspirasi lewat `updateAspirationStatus` (admin).
-- Jadi policy-nya dihapus, bukan ditambal.
DROP POLICY IF EXISTS complaints_owner_update ON complaints;
DROP POLICY IF EXISTS aspirations_owner_update ON aspirations;


-- ---------------------------------------------------------------------
-- 4. `profiles_self_update` mengunci peran, tapi tidak mengunci dinas
--    maupun kelurahan.
--
--  * `dinas_id` bebas ditulis sendiri, sementara `complaints_dinas_update`
--    memberi hak UPDATE atas semua aduan `assigned_dinas =
--    current_dinas_id()`. Satu `dinas_staff` cukup mengganti dinas_id-nya
--    berulang kali untuk memperoleh hak tulis atas seluruh korpus aduan.
--  * `kelurahan` adalah syarat kelayakan memilih di `votes_insert_own`.
--    Karena isinya teks bebas yang ditulis warga sendiri, satu orang bisa
--    berpindah kelurahan sesuka hati dan ikut memilih di setiap kelurahan.
--
-- Kelurahan/kecamatan tetap boleh diisi SEKALI saat onboarding (nilai lama
-- masih NULL) — itulah satu-satunya penulisan yang dilakukan aplikasi
-- (`completeOnboarding` di apps/native/app/_components/AuthProvider.tsx).
-- Perubahan sesudahnya harus lewat admin (`profiles_admin_all`).
--
-- Pola fungsi bantu ini sama persis dengan `current_role_name()` yang
-- sudah dipakai untuk mengunci `role`: fungsi STABLE membaca snapshot awal
-- pernyataan, sehingga yang terbaca adalah nilai SEBELUM UPDATE.
CREATE OR REPLACE FUNCTION current_kelurahan() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kelurahan FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_kecamatan() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kecamatan FROM profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = current_role_name()
    AND dinas_id IS NOT DISTINCT FROM current_dinas_id()
    AND (current_kelurahan() IS NULL OR kelurahan IS NOT DISTINCT FROM current_kelurahan())
    AND (current_kecamatan() IS NULL OR kecamatan IS NOT DISTINCT FROM current_kecamatan())
  );


-- ---------------------------------------------------------------------
-- 5. Warga tidak boleh memalsukan riwayat resmi aduan.
--
-- `event_type` adalah TEXT tanpa CHECK, dan `timeline_insert` mengizinkan
-- pemilik aduan menyisipkan baris dengan event_type apa pun. Warga bisa
-- menulis entri 'verified'/'resolved' berisi catatan karangan yang tampil
-- publik, dan karena `get_ringkasan_stats` menghitung `avg_response_hours`
-- dari baris `event_type = 'verified'`, entri palsu itu ikut menggeser
-- metrik waktu respons yang dipublikasikan.
ALTER TABLE complaint_timeline
  DROP CONSTRAINT IF EXISTS complaint_timeline_event_type_check;
ALTER TABLE complaint_timeline
  ADD CONSTRAINT complaint_timeline_event_type_check
  CHECK (event_type IN (
    'created', 'ai_classified', 'verified', 'rejected',
    'progress', 'resolved', 'citizen_comment'
  ));

DROP POLICY IF EXISTS timeline_insert ON complaint_timeline;
CREATE POLICY timeline_insert ON complaint_timeline FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      current_role_name() IN ('verifier','dinas_staff','dinas_head','admin')
      OR (
        -- Pelapor hanya boleh menambah komentar pada aduannya sendiri.
        event_type = 'citizen_comment'
        AND EXISTS (SELECT 1 FROM complaints c
                    WHERE c.id = complaint_id AND c.user_id = auth.uid())
      )
    )
  );


-- ---------------------------------------------------------------------
-- 6. `get_pending_decisions` menerima kelurahan dari pemanggil.
--
-- Fungsi ini SECURITY DEFINER, tanpa pemeriksaan peran, dan GRANT-nya ke
-- `authenticated`. Karena `find_or_create_user` membuatkan profil untuk
-- alamat email mana pun yang menyelesaikan OTP, siapa pun yang punya kotak
-- masuk bisa memanggilnya berulang kali untuk setiap nama kelurahan dan
-- memanen judul permohonan layanan LENGKAP DENGAN NAMA PEMOHON — termasuk
-- 'Surat Keterangan Tidak Mampu — <nama warga>', yaitu data status
-- kesejahteraan seseorang. Ini melewati `service_owner_read` yang seharusnya
-- membatasi service_requests ke pemilik dan petugas.
--
-- Cakupan sekarang diambil dari profil pemanggil, sama seperti
-- `get_ringkasan_stats`/`get_sla_compliance_daily` di migrasi yang sama.
-- Parameter dipertahankan (klien lama tetap kompatibel) tapi diabaikan.
CREATE OR REPLACE FUNCTION get_pending_decisions(p_kelurahan TEXT DEFAULT NULL)
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
  WITH caller AS (
    SELECT role, kelurahan FROM profiles WHERE id = auth.uid()
  )
  SELECT
    'aspirasi' AS source,
    a.id AS ref_id,
    a.title AS title,
    a.vote_count || ' dukungan' AS subtitle,
    a.created_at
  FROM aspirations a
  WHERE a.status = 'musrenbang'
    AND (SELECT role FROM caller) IN ('verifier','dinas_staff','dinas_head','admin')
    AND a.kelurahan = (SELECT kelurahan FROM caller)

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
  WHERE sr.status = 'verifying'
    AND (SELECT role FROM caller) IN ('verifier','dinas_staff','dinas_head','admin')
    AND p.kelurahan = (SELECT kelurahan FROM caller)

  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_pending_decisions(TEXT) TO authenticated;


-- ---------------------------------------------------------------------
-- 7. Menonaktifkan akun harus langsung memutus sesinya.
--
-- `disabled_at` hanya diperiksa di `auth-verify-otp`. Perangkat yang sudah
-- masuk tidak pernah mengulang OTP — ia cukup merotasi refresh token setiap
-- jam — sehingga operator yang dinonaktifkan tetap memegang akses selama
-- sisa SESSION_TTL 30 hari, termasuk ke lokasi langsung dan audio SOS.
-- (Sisi Edge Function-nya diperbaiki terpisah di supabase/functions/auth-refresh.)
CREATE OR REPLACE FUNCTION disable_user(p_user_id UUID, p_disabled BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_role_name() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menonaktifkan/mengaktifkan pengguna'
      USING ERRCODE = '42501';
  END IF;

  UPDATE users
  SET disabled_at = CASE WHEN p_disabled THEN NOW() ELSE NULL END
  WHERE id = p_user_id;

  IF p_disabled THEN
    UPDATE auth_sessions
    SET revoked_at = NOW(), revoked_reason = 'admin_disabled'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;
END; $$;

-- Menurunkan/mengubah peran juga harus memutus sesi: klaim `app_role` ikut
-- tercetak di access token dan dipercaya oleh `generate-service-pdf`, jadi
-- tanpa pencabutan, peran lama tetap berlaku sampai token kedaluwarsa.
CREATE OR REPLACE FUNCTION set_user_role(
  p_user_id UUID, p_role user_role, p_dinas_id TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_role_name() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah peran pengguna'
      USING ERRCODE = '42501';
  END IF;

  UPDATE profiles SET role = p_role, dinas_id = p_dinas_id WHERE id = p_user_id;

  UPDATE auth_sessions
  SET revoked_at = NOW(), revoked_reason = 'role_changed'
  WHERE user_id = p_user_id AND revoked_at IS NULL;
END; $$;

GRANT EXECUTE ON FUNCTION set_user_role(UUID, user_role, TEXT) TO authenticated;


-- ---------------------------------------------------------------------
-- 8. `refresh_leaderboard()` adalah REFRESH MATERIALIZED VIEW CONCURRENTLY
--    yang bisa dipanggil siapa saja.
--
-- Catatan aslinya menyatakan cukup digerbangi "di level UI", tapi tombol di
-- dashboard bukan kontrol keamanan: memanggil RPC ini dalam gelung memaksa
-- pembangunan ulang agregat `profiles ⋈ complaints ⋈ point_ledger` berkali-
-- kali — beban CPU basis data yang sama yang juga melayani lalu lintas SOS.
CREATE OR REPLACE FUNCTION refresh_leaderboard() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_role_name() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menyegarkan papan peringkat'
      USING ERRCODE = '42501';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY kelurahan_leaderboard;
END; $$;
