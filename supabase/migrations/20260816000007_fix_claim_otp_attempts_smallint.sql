-- Memperbaiki tipe kolom `attempts` di hasil `claim_otp_attempt` agar
-- cocok dengan tipe SMALLINT pada kolom `auth_otp_codes.attempts`.
DROP FUNCTION IF EXISTS claim_otp_attempt(TEXT);

CREATE OR REPLACE FUNCTION claim_otp_attempt(p_email TEXT)
RETURNS TABLE (otp_id BIGINT, code_hash TEXT, attempts SMALLINT, exhausted BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT c.id INTO v_id
  FROM auth_otp_codes c
  WHERE c.email = p_email
    AND c.consumed_at IS NULL
    AND c.expires_at > NOW()
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE auth_otp_codes c
  SET attempts = c.attempts + 1,
      consumed_at = CASE WHEN c.attempts + 1 >= 5 THEN NOW() ELSE c.consumed_at END
  WHERE c.id = v_id
  RETURNING c.id, c.code_hash, c.attempts, (c.attempts >= 5);
END; $$;

REVOKE ALL ON FUNCTION claim_otp_attempt(TEXT) FROM PUBLIC;
