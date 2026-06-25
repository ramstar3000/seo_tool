#!/usr/bin/env bash
# Run build + lint and list required environment variables for SynapseCRO.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm run lint"
npm run lint

echo ""
echo "==> npm run build"
npm run build

echo ""
echo "==> Environment variables"
cat << 'ENV'

Required for core app (database + auth):
  NEXT_PUBLIC_SUPABASE_URL       Supabase project URL (or SUPABASE_URL)
  NEXT_PUBLIC_SUPABASE_ANON_KEY  Supabase anon/publishable key (or SUPABASE_PUBLISHABLE_KEY)
  SUPABASE_SERVICE_ROLE_KEY      Service role key for server-side writes (or SUPABASE_SECRET_KEY)

Required for full agent features:
  ANTHROPIC_API_KEY              Claude API key for research agent, CRO optimize, and GitHub PR edits

Optional — enhanced discovery & scraping:
  SERPAPI_KEY                    Live Google SERP for lead discovery and competitor research
  FIRECRAWL_API_KEY              JS-rendered page scraping fallback in research audits

Optional — GitHub PR automation:
  GITHUB_TOKEN                   Personal access token with repo scope

Optional — cron / scheduled optimize:
  CRON_SECRET                    Bearer token for manual POST /api/optimize (Vercel cron uses x-vercel-cron)

Optional — Core Web Vitals in research audits:
  GOOGLE_PAGESPEED_API_KEY       Google PageSpeed Insights API key (skips gracefully if unset)

Optional — Slack notifications:
  SLACK_WEBHOOK_URL              Incoming webhook for audit-complete and PR-created alerts

Optional — database reset script (scripts/reset-and-seed.sh):
  SUPABASE_DB_URL                Direct Postgres URI (or DATABASE_URL)

Optional — reserved for future enrichment:
  GOOGLE_PLACES_API_KEY          Google Places API (not wired yet)

Copy .env.local.example to .env.local and fill in values before running locally.

ENV

echo "dev-check passed."
