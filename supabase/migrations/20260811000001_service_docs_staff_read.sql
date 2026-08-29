-- Petugas (verifier/dinas_staff/dinas_head/admin) perlu membaca dokumen KTP/KK
-- yang diunggah warga ke `service-docs` untuk meninjau permohonan layanan
-- (`service_owner_read` sudah mengizinkan mereka membaca baris
-- `service_requests`, tapi storage.objects punya RLS terpisah dan sebelum
-- migrasi ini hanya pemilik dokumen yang punya policy SELECT — lihat
-- "pemilik membaca dokumen privatnya" di 20260810000007_storage.sql).
CREATE POLICY "petugas membaca dokumen layanan"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'service-docs'
    AND current_role_name() IN ('verifier','dinas_staff','dinas_head','admin')
  );
