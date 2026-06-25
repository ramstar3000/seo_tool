#!/usr/bin/env bash
# Reset SynapseCRO Supabase public schema locally via psql, or print manual steps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESET_SQL="$ROOT/supabase/reset.sql"
SCHEMA_SQL="$ROOT/supabase/schema.sql"
COMBINED="$ROOT/supabase/reset-and-schema.sql"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
elif [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  cat << 'MANUAL'

Cannot reset automatically: no direct Postgres connection string found.

Set one of these in .env or .env.local (from Supabase Dashboard → Project Settings → Database → Connection string → URI):
  SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...
  DATABASE_URL=postgresql://...

Your project currently uses REST keys only (SUPABASE_URL + SUPABASE_SECRET_KEY). Those cannot run DDL.

Manual reset (recommended for cloud projects):
  1. Open Supabase Dashboard → SQL Editor → New query
  2. Paste the contents of: supabase/reset-and-schema.sql
  3. Click Run — wait for success, then use the app (seed leads via /leads → Run Discovery)

Alternative (two steps):
  1. Run supabase/reset.sql in SQL Editor
  2. Run supabase/schema.sql in SQL Editor

MANUAL
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install PostgreSQL client tools or use supabase/reset-and-schema.sql in the SQL Editor."
  exit 1
fi

echo "Running reset (drops)..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$RESET_SQL"
echo "Applying schema..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL"
echo "Done. Combined one-file option: $COMBINED"
