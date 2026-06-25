#!/usr/bin/env bash
# Basic smoke checks — no API keys required for validation endpoints.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> Smoke test against ${BASE_URL}"

echo "-- GET /api/health"
health=$(curl -sf "${BASE_URL}/api/health")
echo "${health}" | grep -q '"ok":true'

echo "-- POST /api/analytics (invalid body → 400)"
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE_URL}/api/analytics" \
  -H 'Content-Type: application/json' \
  -d '{}')
if [[ "${status}" != "400" && "${status}" != "503" ]]; then
  echo "Expected 400 or 503 from analytics validation, got ${status}"
  exit 1
fi

echo "-- POST /api/audit-request (invalid body → 400)"
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE_URL}/api/audit-request" \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email","websiteUrl":"bad"}')
if [[ "${status}" != "400" && "${status}" != "503" ]]; then
  echo "Expected 400 or 503 from audit-request validation, got ${status}"
  exit 1
fi

echo "smoke-test passed."
