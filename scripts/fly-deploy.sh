#!/usr/bin/env bash
# Deploy SynapseCRO to Fly.io (requires fly CLI + logged in).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v fly >/dev/null 2>&1; then
  echo "Fly CLI not found. Install: https://fly.io/docs/flyctl/install/"
  exit 1
fi

if [[ ! -f fly.toml ]]; then
  echo "fly.toml missing in project root."
  exit 1
fi

APP="$(grep -E "^app = " fly.toml | head -1 | sed "s/app = '//;s/'//")"
echo "==> Deploying app: ${APP}"

if ! fly status -a "${APP}" >/dev/null 2>&1; then
  echo "App '${APP}' not found. Create it first:"
  echo "  fly apps create ${APP}"
  exit 1
fi

echo "==> Checking required secrets..."
for name in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY GEMINI_API_KEY ANTHROPIC_API_KEY; do
  if ! fly secrets list -a "${APP}" 2>/dev/null | grep -q "^${name}"; then
    echo "Missing secret: ${name}"
    echo "Run: fly secrets import < .env"
    exit 1
  fi
done

if ! fly secrets list -a "${APP}" 2>/dev/null | grep -q "^CRON_SECRET"; then
  echo "Warning: CRON_SECRET not set. Scheduled jobs will 401 until you run:"
  echo "  fly secrets set CRON_SECRET=\"\$(openssl rand -hex 32)\" -a ${APP}"
fi

echo "==> fly deploy"
fly deploy -a "${APP}"

echo ""
echo "==> Health check"
BASE="https://${APP}.fly.dev"
sleep 5
curl -sf "${BASE}/api/health" | python3 -m json.tool 2>/dev/null || curl -sf "${BASE}/api/health"
echo ""
echo "Deployed: ${BASE}"
