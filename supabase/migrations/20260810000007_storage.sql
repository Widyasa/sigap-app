-- Bucket publik: foto aduan, foto progres, foto aspirasi.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('complaint-photos', 'complaint-photos', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('progress-photos',  'progress-photos',  true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('aspiration-photos','aspiration-photos',true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Bucket PRIVAT: dokumen identitas dan audio darurat.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('service-docs',    'service-docs',    false, 10485760,
   ARRAY['image/jpeg','image/png','application/pdf']),
  ('emergency-audio', 'emergency-audio', false, 5242880,
   ARRAY['audio/m4a','audio/mpeg','audio/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "foto publik dapat dibaca siapa pun"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('complaint-photos','progress-photos','aspiration-photos'));

CREATE POLICY "warga unggah ke foldernya sendiri"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('complaint-photos','aspiration-photos','service-docs','emergency-audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pemilik membaca dokumen privatnya"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('service-docs','emergency-audio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "petugas mengunggah foto progres"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND current_role_name() IN ('dinas_staff','dinas_head','verifier','admin')
  );
