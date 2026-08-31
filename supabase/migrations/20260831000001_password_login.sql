-- =====================================================================
-- Login password untuk admin & staff (issue: alternatif login OTP).
-- Warga/citizen tetap login OTP; password hanya boleh digunakan
-- oleh pengguna dengan peran selain 'citizen'.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- -----------------------------------------------------------------
-- Tabel log percobaan password untuk rate limit per email + IP.
-- Baris dipanen setelah 24 jam; fungsi cleanup di bawah dipanggil
-- secara oportunistik oleh auth-login-password.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_password_attempts (
  id         BIGSERIAL PRIMARY KEY,
  email      CITEXT NOT NULL,
  requester_ip INET,
  success    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_password_attempts_email_idx
  ON auth_password_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_password_attempts_ip_idx
  ON auth_password_attempts (requester_ip, created_at DESC)
  WHERE requester_ip IS NOT NULL;

-- Tabel ini hanya boleh disentuh oleh service role (Edge Function).
-- RLS aktif tanpa policy memastikan tidak ada klien anon/authenticated
-- yang dapat membaca atau menulis log percobaan.
ALTER TABLE auth_password_attempts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------
-- Fungsi bantu: hapus log percobaan password yang sudah tua.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_password_attempts()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_password_attempts WHERE created_at < NOW() - INTERVAL '1 day';
$$;

-- -----------------------------------------------------------------
-- Rate limit password: maksimal 5 percobaan gagal per email per 15 menit,
-- dan maksimal 20 percobaan gagal per IP per 15 menit.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_password_rate_limit(
  p_email CITEXT,
  p_ip    INET
)
RETURNS TABLE (allowed BOOLEAN, reason TEXT, retry_after_seconds INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email_fails INT;
  v_ip_fails    INT;
BEGIN
  SELECT COUNT(*) INTO v_email_fails
    FROM auth_password_attempts
   WHERE email = p_email
     AND success = FALSE
     AND created_at > NOW() - INTERVAL '15 minutes';

  IF v_email_fails >= 5 THEN
    RETURN QUERY SELECT FALSE, 'too_many_attempts', 900;
    RETURN;
  END IF;

  IF p_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_fails
      FROM auth_password_attempts
     WHERE requester_ip = p_ip
       AND success = FALSE
       AND created_at > NOW() - INTERVAL '15 minutes';

    IF v_ip_fails >= 20 THEN
      RETURN QUERY SELECT FALSE, 'too_many_attempts', 900;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, 0;
END; $$;

-- -----------------------------------------------------------------
-- Catat percobaan password (berhasil maupun gagal).
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_password_attempt(
  p_email   CITEXT,
  p_ip      INET,
  p_success BOOLEAN
)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO auth_password_attempts (email, requester_ip, success)
  VALUES (p_email, p_ip, p_success);
$$;

-- -----------------------------------------------------------------
-- Admin mengatur/reset password untuk pengguna lain.
-- Password disimpan sebagai hash PBKDF2; Edge Function yang menghasilkan
-- hash, bukan klien, supaya format tetap terstandarisasi.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_user_password(
  p_email         CITEXT,
  p_password_hash TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_role user_role;
BEGIN
  IF current_role_name() <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can set passwords' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Pastikan target bukan warga; password hanya untuk staff/admin.
  SELECT p.role INTO v_target_role
    FROM profiles p
    JOIN users u ON u.id = p.id
   WHERE u.email = p_email;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_target_role = 'citizen' THEN
    RAISE EXCEPTION 'Password login is not allowed for citizen role' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE users SET password_hash = p_password_hash WHERE email = p_email;
END; $$;
