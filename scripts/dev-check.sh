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
  GOOGLE_GENERATIVE_AI_API_KEY   Primary LLM key (Gemini / DeepMind; @ai-sdk/google convention)
  GEMINI_API_KEY                 Alias for GOOGLE_GENERATIVE_AI_API_KEY (checked first)
  ANTHROPIC_API_KEY              Fallback LLM if Gemini is not configured

Optional — enhanced discovery & scraping:
  TAVILY_API_KEY                   Tavily web search for lead discovery and competitor research
  FIRECRAWL_API_KEY              JS-rendered page scraping fallback in research audits

Optional — GitHub PR automation:
  GITHUB_TOKEN                   Personal access token with repo scope
  GITHUB_PAT_TOKEN               Alias for GITHUB_TOKEN (either name works locally)

Optional — Fly.io / cron (see docs/FLY_DEPLOY.md):
  CRON_SECRET                    Bearer token for POST /api/optimize and GET /api/cron/re-audit-leads

Optional — Core Web Vitals in research audits:
  GOOGLE_PAGESPEED_API_KEY       Google PageSpeed Insights API key (skips gracefully if unset)
  GOOGLE_API_KEY                 PageSpeed fallback only (not used for Gemini/LLM)

Optional — Slack notifications:
  SLACK_WEBHOOK_URL              Incoming webhook for audit-complete and PR-created alerts

Optional — visitor audit emails (Resend):
  RESEND_API_KEY                 Sends actionable audit summary when visitor audits complete
  RESEND_FROM_EMAIL              Verified sender (defaults to onboarding@resend.dev for testing)

Optional — production links in emails:
  NEXT_PUBLIC_APP_URL            Public app URL used in audit report links

Optional — database reset script (scripts/reset-and-seed.sh):
  SUPABASE_DB_URL                Direct Postgres URI (or DATABASE_URL)

Optional — ClickHouse (see docs/CLICKHOUSE.md):
  CLICKHOUSE_URL                 ClickHouse Cloud HTTPS endpoint (:8443)
  CLICKHOUSE_USER                Username (default: default)
  CLICKHOUSE_PASSWORD            Password from ClickHouse Cloud
  CLICKHOUSE_DATABASE            Database name (default: default)
  Enables: conversion funnel, SEO insight memory, prompt context for GitHub PRs

Local dev (no cloud creds):
  npm run clickhouse:up      Start ClickHouse in Docker (http://localhost:8123)
  npm run clickhouse:smoke   Init tables + insert/query smoke test (no Next.js)
  npm run clickhouse:down    Stop local ClickHouse container

Optional — reserved for future enrichment:
  GOOGLE_PLACES_API_KEY          Google Places API (not wired yet)

Copy .env.local.example to .env.local and fill in values before running locally.

ENV

echo "dev-check passed."
