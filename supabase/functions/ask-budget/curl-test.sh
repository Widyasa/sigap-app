#!/usr/bin/env bash
# Manual contract check for ask-budget (issue #1 testing philosophy: "minimal
# satu curl untuk kontrak endpoint"). Requires a running local stack
# (`supabase start`) and a valid access token for a citizen user.
#
# Usage:
#   ACCESS_TOKEN=<jwt> ./curl-test.sh [supabase-url]
#
# Get an access token locally by calling auth-request-otp / auth-verify-otp
# with OTP_DEV_MODE=true (see supabase/functions/.env), or read one from a
# logged-in session in the app.

set -euo pipefail

SUPABASE_URL="${1:-http://127.0.0.1:54321}"
: "${ACCESS_TOKEN:?Set ACCESS_TOKEN to a valid access token}"

echo "== Question with matching seeded data =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/ask-budget" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"question":"Berapa anggaran yang dialokasikan untuk perbaikan drainase Jalan Merdeka dan berapa yang sudah terealisasi?"}' | tee /tmp/ask-budget-hit.json
echo

echo "== Question with no matching data (should return no_data, not a fabricated answer) =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/ask-budget" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"question":"Berapa anggaran renovasi Istana Kepresidenan Jakarta tahun ini?"}' | tee /tmp/ask-budget-miss.json
echo
