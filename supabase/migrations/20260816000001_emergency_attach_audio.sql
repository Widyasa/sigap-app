-- Warga melampirkan rekaman audio konteks ke SOS miliknya SETELAH baris
-- alert dibuat.
--
-- Sebelumnya layar SOS merekam ~10 detik audio dulu, baru INSERT baris
-- emergency_alerts dengan `audio_url` terisi — artinya operator baru melihat
-- laporan darurat 10 detik setelah warga memilih jenis kejadian, padahal
-- audio secara desain bersifat best-effort dan tidak boleh menahan
-- pengiriman SOS. Alert kini dikirim lebih dulu dan audio menyusul lewat
-- fungsi ini.
--
-- SECURITY DEFINER dengan alasan yang sama seperti
-- `update_own_emergency_location` di 20260813000001: RLS
-- `emergency_operator_update` sengaja hanya mengizinkan operator/admin
-- meng-UPDATE emergency_alerts, jadi warga butuh celah sempit khusus —
-- hanya baris miliknya sendiri, hanya selagi SOS masih berjalan, dan hanya
-- kolom `audio_url` yang belum terisi (tidak bisa menimpa/menghapus audio
-- yang sudah ada).
CREATE OR REPLACE FUNCTION attach_own_emergency_audio(
  p_alert_id UUID, p_audio_url TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_audio_url IS NULL OR btrim(p_audio_url) = '' THEN
    RAISE EXCEPTION 'audio_url wajib diisi.' USING ERRCODE = '22023';
  END IF;

  -- Berkas harus berada di folder milik pemanggil sendiri, sama seperti
  -- syarat kebijakan storage "warga unggah ke foldernya sendiri". Tanpa ini
  -- warga bisa melampirkan rekaman milik orang lain ke SOS-nya dan merusak
  -- rantai bukti kejadian darurat.
  IF POSITION('/' || auth.uid()::text || '/' IN p_audio_url) = 0 THEN
    RAISE EXCEPTION 'Berkas audio bukan milik pemanggil.' USING ERRCODE = '42501';
  END IF;

  UPDATE emergency_alerts
  SET audio_url = p_audio_url
  WHERE id = p_alert_id
    AND user_id = auth.uid()
    AND status IN ('active','responding')
    AND audio_url IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS tidak ditemukan, sudah ditutup, atau sudah punya audio.'
      USING ERRCODE = '42501';
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION attach_own_emergency_audio(UUID, TEXT) TO authenticated;
