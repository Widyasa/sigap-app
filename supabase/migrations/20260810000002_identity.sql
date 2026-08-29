-- =====================================================================
-- Identitas SIGAP. Tabel ini menggantikan auth.users milik Supabase Auth.
-- auth.users TIDAK DIPAKAI dan tidak pernah ditulis oleh aplikasi ini.
-- =====================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,        -- citext: Budi@x.id = budi@x.id
  email_verified_at TIMESTAMPTZ,               -- diisi saat OTP pertama berhasil
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  disabled_at   TIMESTAMPTZ,                   -- admin dapat menonaktifkan akun
  CONSTRAINT users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX users_email_idx ON users (email);

-- ---------------------------------------------------------------------
-- Kode OTP. Yang disimpan HANYA hash. Kode asli tidak pernah menyentuh
-- database (aturan T10). Baris disimpan lengkap dengan IP agar rate limit
-- pada aturan S8 dapat dihitung dari satu tabel saja.
-- ---------------------------------------------------------------------
CREATE TABLE auth_otp_codes (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT NOT NULL,
  code_hash     TEXT NOT NULL,                 -- sha256(kode + OTP_PEPPER), hex
  requester_ip  INET,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  consumed_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_otp_email_idx   ON auth_otp_codes (email, created_at DESC);
CREATE INDEX auth_otp_ip_idx      ON auth_otp_codes (requester_ip, created_at DESC);
-- Satu kode aktif per email (aturan S7): indeks parsial menegakkannya di database.
CREATE UNIQUE INDEX auth_otp_one_active_idx
  ON auth_otp_codes (email)
  WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------
-- Sesi. Satu baris per perangkat. Refresh token disimpan sebagai hash dan
-- berotasi setiap dipakai (aturan S10).
-- ---------------------------------------------------------------------
CREATE TABLE auth_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,     -- sha256(token + OTP_PEPPER), hex
  device_label       TEXT,                     -- "Android 14 · Samsung SM-A155F"
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  revoked_reason     TEXT                      -- rotated | signout | reuse_detected | admin
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, created_at DESC);
CREATE INDEX auth_sessions_live_idx ON auth_sessions (expires_at) WHERE revoked_at IS NULL;
