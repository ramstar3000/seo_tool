# SynapseCRO — TODO & setup notes

## Environment variables (see `.env.local.example` and `scripts/dev-check.sh`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side writes |
| `GEMINI_API_KEY` | For full agent | Primary LLM — Gemini (DeepMind sponsor) |
| `ANTHROPIC_API_KEY` | Fallback | Used when Gemini key is absent |
| `TAVILY_API_KEY` | Optional | Live web search / competitor research (Tavily) |
| `FIRECRAWL_API_KEY` | Optional | JS-rendered page scraping |
| `GITHUB_TOKEN` | Optional | GitHub PR automation |
| `CRON_SECRET` | Optional | Manual cron trigger auth |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | Core Web Vitals via PageSpeed Insights |
| `SLACK_WEBHOOK_URL` | Optional | Slack alerts on audit complete / PR created |
| `RESEND_API_KEY` | Optional | Actionable audit summary email when visitor audits complete |
| `RESEND_FROM_EMAIL` | Optional | Verified sender domain (default: `onboarding@resend.dev`) |
| `NEXT_PUBLIC_APP_URL` | Optional | Public URL in audit emails (e.g. production Vercel domain) |

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
4. Optional: set `GOOGLE_PAGESPEED_API_KEY`, `SLACK_WEBHOOK_URL`, `CRON_SECRET` on Fly (`fly secrets set`)

## Fly.io deploy

```bash
./scripts/fly-deploy.sh
# or: fly secrets import < .env && fly deploy
```

Full guide: `docs/FLY_DEPLOY.md`

GitHub cron secrets (for `.github/workflows/fly-cron.yml`):

- `FLY_APP_URL=https://synapsecro.fly.dev`
- `CRON_SECRET` (same as Fly)

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
