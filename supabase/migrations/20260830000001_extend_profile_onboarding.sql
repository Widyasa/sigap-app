-- Alur lengkapi profil (M0) menambah alamat lengkap dan RT.
-- Kolom-kolom ini diisi warga saat onboarding, setelah OTP berhasil
-- dan sebelum masuk ke halaman beranda.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rt TEXT;

-- Policy RLS yang ada (profiles_self_update) tetap berlaku karena tidak
-- membatasi kolom; hanya memastikan pemilik sendiri yang dapat UPDATE.
