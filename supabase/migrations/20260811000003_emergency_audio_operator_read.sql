-- Operator (emergency_operator/admin) perlu mendengar rekaman audio konteks
-- yang diunggah warga ke `emergency-audio` saat memutuskan respons SOS
-- (`emergency_read` sudah mengizinkan mereka membaca baris
-- `emergency_alerts`, tapi storage.objects punya RLS terpisah dan sebelum
-- migrasi ini hanya pemilik audio yang punya policy SELECT — lihat
-- "pemilik membaca dokumen privatnya" di 20260810000007_storage.sql).
-- Sama pola dengan 20260811000001_service_docs_staff_read.sql (issue #11).
CREATE POLICY "operator membaca audio darurat"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'emergency-audio'
    AND current_role_name() IN ('emergency_operator','admin')
  );
