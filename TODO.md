# SynapseCRO — TODO & setup notes

## Environment variables (see `.env.local.example` and `scripts/dev-check.sh`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side writes |
| `ANTHROPIC_API_KEY` | For full agent | Offline heuristics work without |
| `SERPAPI_KEY` | Optional | Live SERP / competitor research |
| `FIRECRAWL_API_KEY` | Optional | JS-rendered page scraping |
| `GITHUB_TOKEN` | Optional | GitHub PR automation |
| `CRON_SECRET` | Optional | Manual cron trigger auth |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | Core Web Vitals via PageSpeed Insights |
| `SLACK_WEBHOOK_URL` | Optional | Slack alerts on audit complete / PR created |

## Completed in recent builds

- Visitor free audit flow (`/audit/[id]`, `audit_requests` table)
- Visitor audit → lead pipeline conversion (`lead_id` on `audit_requests`)
- Core Web Vitals tool (`check_page_speed`) in research agent
- Slack notification stub (`lib/notifications/slack.ts`)
- Weekly re-audit cron (`/api/cron/re-audit-leads`, Mondays 09:00 UTC)
- E2E smoke test (`scripts/smoke-test.sh`)
- Next.js 16 `middleware.ts` → `proxy.ts` migration

## Manual setup (user)

1. Copy `.env.local.example` → `.env.local` and fill Supabase + Anthropic keys
2. Run `supabase/schema.sql` on a fresh Supabase project (squashed, no migrations)
3. `npm run dev` and visit `/` to request a free audit
4. Optional: set `GOOGLE_PAGESPEED_API_KEY`, `SLACK_WEBHOOK_URL`, `CRON_SECRET` on Vercel

## Scripts

```bash
npm run build && npm run lint   # CI check
./scripts/dev-check.sh          # build + lint + env reference
./scripts/smoke-test.sh         # health + validation (server must be running)
BASE_URL=https://your-app.vercel.app ./scripts/smoke-test.sh
```

## Vercel crons (`vercel.json`)

- `*/15 * * * *` — `/api/optimize` (CRO copy optimization)
- `0 9 * * 1` — `/api/cron/re-audit-leads` (re-research stale leads, max 3/run)
