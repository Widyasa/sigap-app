-- Pengumuman (native): kategori, lampiran, dan status baca per-warga.
-- Kategori HARUS identik dengan ANNOUNCEMENT_CATEGORIES di
-- packages/shared/src/constants.ts (lihat catatan "KONSISTENSI KATALOG
-- DINAS" — pola yang sama berlaku untuk katalog kategori pengumuman).

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE announcements ADD CONSTRAINT announcements_category_check
  CHECK (category IS NULL OR category IN
    ('darurat','infrastruktur','kesehatan','layanan','kegiatan','umum'));

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- ---------------------------------------------------------------------
-- announcement_reads: status baca per warga, untuk badge "Belum dibaca"
-- dan tombol "Tandai dibaca" di layar Pengumuman.
-- ---------------------------------------------------------------------
CREATE TABLE announcement_reads (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX announcement_reads_announcement_idx ON announcement_reads (announcement_id);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_reads_own ON announcement_reads FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY announcement_reads_insert_own ON announcement_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Bucket publik untuk lampiran pengumuman (PDF/gambar), maks 10 MB.
-- Dibaca siapa pun (bucket publik); hanya staf (admin/dinas_head/verifier,
-- selaras dengan announcements_staff_write) yang boleh mengunggah.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('announcement-attachments', 'announcement-attachments', true, 10485760,
   ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "lampiran pengumuman dapat dibaca siapa pun"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcement-attachments');

CREATE POLICY "staf mengunggah lampiran pengumuman"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND current_role_name() IN ('admin','dinas_head','verifier')
  );
