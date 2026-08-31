-- Memperbaiki pengecekan kepemilikan audio pada attach_own_emergency_audio.
-- Sebelumnya fungsi mensyaratkan adanya leading slash di depan user_id
-- (`/{user_id}/...`), padahal path yang diunggah ke Supabase Storage disimpan
-- tanpa leading slash (`{user_id}/...`). Akibatnya warga yang mengunggah audio
-- sendiri tetap ditolak dengan pesan "Berkas audio bukan milik pemanggil.".
--
-- Perbaikan: cukup memastikan audio_url diawali dengan folder user sendiri,
-- tanpa mensyaratkan karakter `/` di awal.
CREATE OR REPLACE FUNCTION attach_own_emergency_audio(
  p_alert_id UUID, p_audio_url TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_audio_url IS NULL OR btrim(p_audio_url) = '' THEN
    RAISE EXCEPTION 'audio_url wajib diisi.' USING ERRCODE = '22023';
  END IF;

  -- Berkas harus berada di folder milik pemanggil sendiri. Path yang valid
  -- diawali dengan `<user_id>/` (tanpa leading slash), sesuai konvensi
  -- Supabase Storage.
  IF NOT starts_with(p_audio_url, auth.uid()::text || '/') THEN
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
