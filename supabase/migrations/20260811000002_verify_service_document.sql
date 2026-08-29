-- Verifikasi dokumen publik lewat kode QR (kriteria "Generated PDF contains
-- QR that verifies document authenticity"). Siapa pun yang memindai QR harus
-- bisa memverifikasi TANPA login/sesi warga — karena itu ini RPC
-- SECURITY DEFINER yang dapat dieksekusi oleh `anon`, mengikuti pola
-- `current_role_name()`/`current_dinas_id()` di 20260810000006_rls.sql,
-- alih-alih Edge Function baru yang menghadap publik.
--
-- Keputusan desain (dibanding Edge Function `verify-document`): RPC lebih
-- idiomatik untuk repo ini (sudah memakai SECURITY DEFINER untuk helper RLS),
-- menghindari permukaan CORS publik tambahan, dan lebih mudah diaudit karena
-- bentuk keluarannya dijamin oleh definisi fungsi, bukan oleh disiplin kode
-- TypeScript di edge function.
--
-- PII SAMA SEKALI TIDAK DIKEMBALIKAN: fungsi ini secara sengaja HANYA
-- memilih service_type/status/created_at dan TIDAK PERNAH menyentuh
-- form_data, document_urls, user_id, atau baris `profiles` terkait — jadi
-- tidak ada kolom PII untuk "lupa" disaring, strukturnya sendiri yang
-- menegakkan batas ini.
CREATE OR REPLACE FUNCTION verify_service_document(code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  service_type TEXT,
  status TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    TRUE AS valid,
    sr.service_type,
    sr.status,
    sr.completed_at AS issued_at
  FROM service_requests sr
  WHERE sr.verification_code = code
  LIMIT 1;
$$;

-- Tanpa GRANT EXECUTE eksplisit, anon (dan authenticated) tidak dapat
-- memanggil fungsi ini sama sekali (PostgREST menolak dengan 42501),
-- terlepas dari SECURITY DEFINER.
GRANT EXECUTE ON FUNCTION verify_service_document(TEXT) TO anon, authenticated;
