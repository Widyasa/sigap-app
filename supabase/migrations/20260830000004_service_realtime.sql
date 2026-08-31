-- Mengaktifkan Supabase Realtime (postgres_changes) untuk permohonan layanan,
-- agar petugas melihat permohonan baru dan perubahan status tanpa reload manual.
-- Idempoten: tidak menambahkan tabel kalau sudah terdaftar di publikasi.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'service_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
    END IF;
END
$$;
