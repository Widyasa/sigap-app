-- `verify_service_document` mengembalikan `TRUE AS valid` tanpa syarat.
--
-- Artinya QR pada surat yang SUDAH TERLANJUR DICETAK tetap memverifikasi
-- sebagai "Dokumen Sah" meski permohonannya kemudian dipindahkan ke
-- `rejected` — satu-satunya petunjuk hanyalah baris status kecil di bawah
-- judul besar berwarna hijau. Untuk dokumen resmi kelurahan, itu bacaan yang
-- keliru pada saat yang paling penting: di loket, saat dokumennya dipakai.
--
-- Sekarang hanya `ready` dan `collected` yang dianggap sah — dua status yang
-- benar-benar berarti "surat ini pernah diterbitkan dan masih berlaku".
CREATE OR REPLACE FUNCTION verify_service_document(code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  service_type TEXT,
  status TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sr.status IN ('ready', 'collected') AS valid,
    sr.service_type,
    sr.status,
    sr.completed_at AS issued_at
  FROM service_requests sr
  WHERE sr.verification_code = code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION verify_service_document(TEXT) TO anon, authenticated;
