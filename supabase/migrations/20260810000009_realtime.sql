-- Mengaktifkan Supabase Realtime (postgres_changes) untuk aduan dan
-- timeline-nya, agar warga melihat progres tanpa reload manual (issue #8,
-- kriteria "Timeline updates without manual reload"). RLS SELECT tetap
-- berlaku untuk setiap koneksi realtime karena klien memakai access token
-- JWT yang sama (lihat `createSigapClient`), jadi tidak ada kebocoran data
-- di luar apa yang sudah bisa dibaca lewat PostgREST.
ALTER PUBLICATION supabase_realtime ADD TABLE complaints, complaint_timeline;
