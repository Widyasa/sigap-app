-- Manajemen pengguna admin (issue #14, kriteria "Admin manages users").
--
-- Mengubah PERAN/dinas pengguna lain sudah bisa lewat UPDATE biasa ke
-- `profiles`: RLS `profiles_admin_all` (20260810000006_rls.sql) mengizinkan
-- admin menulis baris profiles siapa pun tanpa syarat tambahan, jadi tidak
-- perlu RPC baru untuk itu.
--
-- MENONAKTIFKAN akun berbeda: tabel `users` sengaja TIDAK punya satu pun
-- policy INSERT/UPDATE/DELETE (lihat catatan di 20260810000006_rls.sql —
-- "Baris users hanya ditulis oleh find_or_create_user() lewat service role
-- key"), jadi admin tidak bisa UPDATE users.disabled_at langsung lewat
-- PostgREST betapa pun perannya. RPC SECURITY DEFINER berikut membuka celah
-- SEMPIT dan terverifikasi peran, mengikuti pola current_role_name()/
-- refresh_leaderboard() yang sudah ada.
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
END; $$;

-- Tanpa GRANT EXECUTE eksplisit, authenticated tidak dapat memanggil fungsi
-- ini sama sekali (PostgREST menolak dengan 42501), terlepas dari SECURITY
-- DEFINER. Otorisasi peran yang sebenarnya tetap dicek DI DALAM fungsi
-- (current_role_name() <> 'admin' di atas), bukan oleh GRANT ini.
GRANT EXECUTE ON FUNCTION disable_user(UUID, BOOLEAN) TO authenticated;
