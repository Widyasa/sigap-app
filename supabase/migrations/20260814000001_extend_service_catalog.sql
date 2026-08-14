-- Menambah dua jenis layanan administrasi baru (kelahiran, kematian) ke
-- katalog M4 Layanan, sesuai `SERVICE_CATALOG` di packages/shared/src/constants.ts
-- (lihat catatan "KONSISTENSI KATALOG DINAS" — tabel ini bukan sumber
-- katalog, hanya CHECK constraint yang harus tetap sinkron).

ALTER TABLE service_requests DROP CONSTRAINT service_requests_service_type_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_service_type_check
  CHECK (service_type IN ('domisili','sktm','pengantar_nikah','izin_keramaian',
                          'usaha','kelahiran','kematian'));

-- Bucket `service-docs` sudah dibuat di 20260810000007_storage.sql dengan
-- limit 10 MB; itu tetap dipakai sebagai batas atas di storage. Klien
-- (formulir pengajuan) menegakkan batas 5 MB per berkas sebelum unggah.
-- INSERT ini murni idempotency guard bila migrasi 20260810000007 belum
-- pernah jalan di environment tertentu.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('service-docs', 'service-docs', false, 5242880,
   ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO NOTHING;
