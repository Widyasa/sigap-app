-- Warga membatalkan SOS miliknya sendiri selagi masih 'active' (belum
-- ditanggapi operator) — jendela pembatalan singkat untuk "salah tekan".
-- SECURITY DEFINER karena RLS emergency_operator_update sengaja hanya
-- mengizinkan operator/admin; ini celah sempit khusus milik sendiri +
-- status masih 'active'.
CREATE OR REPLACE FUNCTION cancel_own_emergency_alert(p_alert_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE emergency_alerts
  SET status = 'false_alarm', resolved_at = NOW()
  WHERE id = p_alert_id AND user_id = auth.uid() AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS tidak ditemukan atau sudah ditanggapi, tidak bisa dibatalkan.'
      USING ERRCODE = '42501';
  END IF;
END; $$;

-- Warga mengirim lokasi terbaru selama SOS-nya masih berjalan (active atau
-- responding). Alasan sama: RLS default tidak mengizinkan warga UPDATE
-- baris emergency_alerts miliknya sendiri.
CREATE OR REPLACE FUNCTION update_own_emergency_location(
  p_alert_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_address TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE emergency_alerts
  SET location_lat = p_lat, location_lng = p_lng,
      location_address = COALESCE(p_address, location_address)
  WHERE id = p_alert_id AND user_id = auth.uid() AND status IN ('active','responding');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS tidak ditemukan atau sudah ditutup.' USING ERRCODE = '42501';
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION cancel_own_emergency_alert(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_own_emergency_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
