-- Penghitung percobaan OTP harus atomik.
--
-- `auth-verify-otp` sebelumnya melakukan baca-ubah-tulis di JavaScript:
-- SELECT baris, bandingkan `row.attempts` dengan batas 5, lalu tulis balik
-- `attempts + 1`. Permintaan yang berjalan bersamaan sama-sama membaca nilai
-- lama, jadi batas 5 hanya berlaku untuk percobaan BERURUTAN. Ribuan tebakan
-- paralel terhadap satu kode 6 digit semuanya melihat `attempts = 0` dan
-- semuanya dievaluasi, sehingga peluang tembus per kode menjadi jauh lebih
-- besar daripada yang dimaksudkan tanpa pernah memicu penguncian.
--
-- Fungsi ini menaikkan penghitung DAN mengambil hash dalam satu pernyataan
-- UPDATE, sehingga baris terkunci untuk setiap pemanggil bergiliran. Hash
-- hanya dikembalikan bila kuota percobaan masih ada; perbandingan hash
-- tetap dilakukan di Edge Function (constant-time, memakai pepper yang tidak
-- pernah masuk basis data).
DROP FUNCTION IF EXISTS claim_otp_attempt(TEXT);

CREATE OR REPLACE FUNCTION claim_otp_attempt(p_email TEXT)
RETURNS TABLE (otp_id BIGINT, code_hash TEXT, attempts SMALLINT, exhausted BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT c.id INTO v_id
  FROM auth_otp_codes c
  WHERE c.email = p_email
    AND c.consumed_at IS NULL
    AND c.expires_at > NOW()
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE auth_otp_codes c
  SET attempts = c.attempts + 1,
      -- Percobaan ke-5 sekaligus menghanguskan kode.
      consumed_at = CASE WHEN c.attempts + 1 >= 5 THEN NOW() ELSE c.consumed_at END
  WHERE c.id = v_id
  RETURNING c.id, c.code_hash, c.attempts, (c.attempts >= 5);
END; $$;

-- Hanya dipanggil dari Edge Function memakai service role key; tidak ada
-- GRANT ke anon/authenticated (kode OTP tidak boleh terjangkau klien).
REVOKE ALL ON FUNCTION claim_otp_attempt(TEXT) FROM PUBLIC;
