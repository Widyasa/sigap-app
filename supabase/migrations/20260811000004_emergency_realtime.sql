-- Mengaktifkan Supabase Realtime (postgres_changes) untuk emergency_alerts,
-- agar warga (status alert miliknya) dan operator (antrean darurat) melihat
-- perubahan status tanpa reload manual (issue #12, kriteria "Operator status
-- changes appear in realtime"). Sama pola dengan
-- 20260810000009_realtime.sql (complaints/complaint_timeline, issue #8) —
-- RLS SELECT (`emergency_read`) tetap berlaku per koneksi realtime karena
-- klien memakai access token JWT yang sama.
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
