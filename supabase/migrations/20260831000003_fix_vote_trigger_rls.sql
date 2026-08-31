-- Triggers sync_upvote_count / sync_vote_count menaik/menurunkan
-- upvote_count/vote_count lewat UPDATE pada tabel complaints dan aspirations.
-- Setelah security_hardening menghapus owner UPDATE policies, UPDATE tersebut
-- gagal karena trigger berjalan sebagai invoker (warga) yang tidak punya hak.
-- Jalankan trigger dengan hak pemilik fungsi sehingga sinkronisasi counter
-- tetap bekerja tanpa memberikan hak UPDATE langsung ke warga.
ALTER FUNCTION sync_upvote_count() SECURITY DEFINER;
ALTER FUNCTION sync_upvote_count() SET search_path = public;

ALTER FUNCTION sync_vote_count() SECURITY DEFINER;
ALTER FUNCTION sync_vote_count() SET search_path = public;
