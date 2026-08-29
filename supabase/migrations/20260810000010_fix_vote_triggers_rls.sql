-- Bug ditemukan lewat pengujian issue #8: `sync_upvote_count()` dan
-- `sync_vote_count()` tidak SECURITY DEFINER, sehingga UPDATE internalnya ke
-- `complaints.upvote_count` / `aspirations.vote_count` berjalan sebagai
-- role pemanggil (warga yang mendukung). RLS `complaints`/`aspirations`
-- tidak punya policy UPDATE yang mengizinkan warga sembarang menaikkan
-- kolom aduan/aspirasi ORANG LAIN (hanya pemilik/verifikator/dinas), jadi
-- UPDATE trigger itu senyap 0-baris — baris `complaint_upvotes` tetap
-- tercatat benar (RLS insert-nya sendiri OK), tapi counter tidak pernah
-- naik untuk dukungan lintas-pengguna. SECURITY DEFINER membuat trigger
-- berjalan sebagai pemilik fungsi (bypass RLS) khusus untuk operasi
-- sempit ini, sama seperti pola `current_role_name()` dkk.
CREATE OR REPLACE FUNCTION sync_upvote_count() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE complaints SET upvote_count = upvote_count + 1 WHERE id = NEW.complaint_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE complaints SET upvote_count = GREATEST(upvote_count - 1, 0)
      WHERE id = OLD.complaint_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION sync_vote_count() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE aspirations SET vote_count = vote_count + 1 WHERE id = NEW.aspiration_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE aspirations SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.aspiration_id;
  END IF;
  RETURN NULL;
END; $$;
