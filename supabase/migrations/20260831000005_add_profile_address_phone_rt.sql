-- Profil warga sekarang mencakup alamat lengkap, telepon, RT/RW
-- (diperlukan oleh onboarding dan validasi kelengkapan profil).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone    TEXT,
  ADD COLUMN IF NOT EXISTS address  TEXT,
  ADD COLUMN IF NOT EXISTS rt       TEXT;
