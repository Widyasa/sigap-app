#!/usr/bin/env bash
# Manual contract check for generate-service-pdf. Requires a running local
# stack (`supabase start`) and a service_requests row owned by the citizen
# whose ACCESS_TOKEN you pass, with status = 'signing' (staff-approved,
# ready for document generation — see service_staff_update RLS policy and
# the status flow comment in index.ts).
#
# Usage:
#   ACCESS_TOKEN=<jwt> SERVICE_REQUEST_ID=<uuid> ./curl-test.sh [supabase-url]

set -euo pipefail

SUPABASE_URL="${1:-http://127.0.0.1:54321}"
: "${ACCESS_TOKEN:?Set ACCESS_TOKEN to a valid access token}"
: "${SERVICE_REQUEST_ID:?Set SERVICE_REQUEST_ID to a service_requests row id with status='signing'}"

echo "== Generate PDF + QR for an approved service request =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/generate-service-pdf" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"serviceRequestId\":\"$SERVICE_REQUEST_ID\"}" | tee /tmp/generate-service-pdf.json
echo

echo "== Unknown request id (should return not_found) =="
curl -sS -X POST "$SUPABASE_URL/functions/v1/generate-service-pdf" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"serviceRequestId":"00000000-0000-0000-0000-000000000000"}'
echo
