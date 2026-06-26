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
  GEMINI_API_KEY                 Primary LLM (Gemini / DeepMind) for agent, CRO, PR edits
  GOOGLE_GENERATIVE_AI_API_KEY   Alias for GEMINI_API_KEY (@ai-sdk/google convention)
  GOOGLE_API_KEY                 Alias for GEMINI_API_KEY (common GCP key name)
  ANTHROPIC_API_KEY              Fallback LLM if Gemini is not configured

Optional — enhanced discovery & scraping:
  TAVILY_API_KEY                   Tavily web search for lead discovery and competitor research
  FIRECRAWL_API_KEY              JS-rendered page scraping fallback in research audits

Optional — GitHub PR automation:
  GITHUB_TOKEN                   Personal access token with repo scope

Optional — Fly.io / cron (see docs/FLY_DEPLOY.md):
  CRON_SECRET                    Bearer token for POST /api/optimize and GET /api/cron/re-audit-leads

Optional — Core Web Vitals in research audits:
  GOOGLE_PAGESPEED_API_KEY       Google PageSpeed Insights API key (skips gracefully if unset)
                                 Falls back to GOOGLE_API_KEY when unset

Optional — Slack notifications:
  SLACK_WEBHOOK_URL              Incoming webhook for audit-complete and PR-created alerts

Optional — visitor audit emails (Resend):
  RESEND_API_KEY                 Sends actionable audit summary when visitor audits complete
  RESEND_FROM_EMAIL              Verified sender (defaults to onboarding@resend.dev for testing)

Optional — production links in emails:
  NEXT_PUBLIC_APP_URL            Public app URL used in audit report links

Optional — database reset script (scripts/reset-and-seed.sh):
  SUPABASE_DB_URL                Direct Postgres URI (or DATABASE_URL)

Optional — reserved for future enrichment:
  GOOGLE_PLACES_API_KEY          Google Places API (not wired yet)

Copy .env.local.example to .env.local and fill in values before running locally.

ENV

echo "dev-check passed."
