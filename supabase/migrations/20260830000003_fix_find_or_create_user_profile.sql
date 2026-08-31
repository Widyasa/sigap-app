-- Pulihkan ke konsisten: user harus selalu punya baris profil.
-- Sebelumnya `find_or_create_user` hanya membuat profil saat user baru;
-- kalau insert profil gagal di tengah transaksi (atau data lama tidak punya
-- profil), user bisa login tanpa profil dan tidak pernah diarahkan ke onboarding.
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

    v_new := TRUE;
  ELSE
    UPDATE users SET last_login_at = NOW(), email_verified_at = COALESCE(email_verified_at, NOW())
    WHERE id = v_id;
  END IF;

  -- Pastikan profil selalu ada, termasuk untuk user lama yang kehilangan
  -- baris profil karena kegagalan transaksi sebelumnya.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_id) THEN
    INSERT INTO profiles (id, full_name) VALUES (v_id, 'Warga');
  END IF;

  RETURN QUERY SELECT v_id, v_new, (v_disabled IS NOT NULL);
END; $$;
