#!/usr/bin/env bash
# Manual contract check for ocr-doc (issue #1 testing philosophy: "minimal
# satu curl untuk kontrak endpoint"). Requires a running local stack
# (`supabase start`) and a valid access token for a citizen user.
#
# Usage:
#   ACCESS_TOKEN=<jwt> ./curl-test.sh [supabase-url]
#
# Get an access token locally by calling auth-request-otp / auth-verify-otp
# with OTP_DEV_MODE=true (see supabase/functions/.env), or read one from a
# logged-in session in the app.
#
# testdata/ktp-sample.png is a synthetic (non-real) KTP-like image generated
# for this test — plausible field layout, no real citizen data.

set -euo pipefail

SUPABASE_URL="${1:-http://127.0.0.1:54321}"
: "${ACCESS_TOKEN:?Set ACCESS_TOKEN to a valid access token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_B64="$(base64 -w0 "$SCRIPT_DIR/testdata/ktp-sample.png")"

echo "== OCR a synthetic KTP image (should return ok:true with per-field confidence) =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/ocr-doc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"imageBase64\":\"$IMAGE_B64\",\"mimeType\":\"image/png\",\"documentType\":\"ktp\"}" \
  | tee /tmp/ocr-doc-ktp.json
echo

echo "== Invalid documentType (should return 400 invalid_request) =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/ocr-doc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"imageBase64\":\"$IMAGE_B64\",\"mimeType\":\"image/png\",\"documentType\":\"passport\"}" \
  -w "\nHTTP %{http_code}\n"
echo

echo "== No Authorization header (should return 401 session_expired) =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/ocr-doc" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$IMAGE_B64\",\"mimeType\":\"image/png\",\"documentType\":\"ktp\"}" \
  -w "\nHTTP %{http_code}\n"
echo
