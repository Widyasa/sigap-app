-- Seeder akun petugas untuk demo/lokal.
-- Email ini akan mendapat peran admin sehingga bisa masuk dashboard
-- dan membuka seluruh menu petugas.
DO $$
DECLARE
  v_email   CITEXT := 'widyarusmananda15@gmail.com';
  v_name    TEXT   := 'Widyasa Rusmananda';
  v_user_id UUID;
BEGIN
  -- Pastikan baris users ada untuk email target.
  SELECT id INTO v_user_id FROM users WHERE email = v_email;

  IF NOT FOUND THEN
    v_user_id := gen_random_uuid();
    INSERT INTO users (id, email, email_verified_at)
    VALUES (v_user_id, v_email, NOW());
  END IF;

  -- Pastikan profilnya memiliki peran petugas (admin = akses penuh dashboard).
  INSERT INTO profiles (id, full_name, role)
  VALUES (v_user_id, v_name, 'admin')
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        full_name = EXCLUDED.full_name;
END $$;
