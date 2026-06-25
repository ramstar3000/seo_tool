# 🧠 Project: SynapseCRO (Self-Optimizing Neuro-Agent)

### 📌 Hackathon Submission
* **Event:** Cursor Hands-Off Hackathon — London
* **Core Concept:** Utilizing basic neuroscience loops (Sensory Input ➔ Cognitive Evaluation ➔ Motor Execution) to build a web page that optimizes its own conversion and search visibility in real-time completely hands-off.
* **Stack:** Next.js (App Router), Supabase (Realtime Engine), Vercel Edge, Tailwind CSS, Anthropic `claude-3-5-haiku`.

---

## 📖 Project Overview
Traditional landing pages are static. If a value proposition fails to connect with an audience, it stays broken until a human marketer runs an analysis, writes new copy, and deploys code days later.

**SynapseCRO** behaves like a living biological organism. It uses an autonomous, closed-loop system modeled directly after basic cognitive neuroscience principles to monitor visitor behavior, run diagnostic loops, and hot-swap its own marketing layout via real-time edge infrastructure while its founders are completely away from their keyboards.

```
   [SENSORY INPUT]              [COGNITIVE CORE]            [MOTOR EXECUTION]
User Traffic & Clicks   ───>   LLM Evaluation Loop   ───>   Real-time Database Row
(analytics_events)             (api/optimize route)          Rewrite (site_copy)
▲                                                              │
└─────────────────── Live DOM Updates via ─────────────────────┘
Supabase Realtime Engine
```

### 🧠 The Neuroscience Framework
1. **The Sensory Cortex (Analytics Capture):** Captures micro-interactions (page views, scroll depth thresholds, call-to-action clicks) and streams them instantly to an explicit transaction ledger.
2. **The Prefrontal Cortex (Evaluation Loop):** An autonomous edge-worker that triggers on a set schedule. It extracts current performance coefficients, cross-references them against active text values, and programmatically reasons using an LLM.
3. **The Motor System (Edge Execution):** If the agent detects a processing bottleneck (e.g., high traffic but low conversion), it performs a direct write operation to the Supabase layer. This shifts the layout and values instantly via web socket synchronization—bypassing lengthy Git/Vercel redeploy times.

---

## 🚀 Quick Start

### 1. Database Setup (Supabase)

Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL Editor. This creates all tables, RLS policies, indexes, and Realtime publications in one step.

For a full reset, use [`supabase/reset-and-schema.sql`](supabase/reset-and-schema.sql).

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side writes only) |
| `ANTHROPIC_API_KEY` | Anthropic API key for the CRO agent |
| `CRON_SECRET` | Optional bearer token for manual `/api/optimize` triggers (Vercel cron uses `x-vercel-cron`) |
| `RESEND_API_KEY` | Optional — sends “Your audit is ready” email when visitor audits complete |
| `NEXT_PUBLIC_APP_URL` | Optional — base URL for audit emails (defaults to Vercel URL or localhost) |

### 3. Authentication (Supabase)

1. In the [Supabase dashboard](https://supabase.com/dashboard), open **Authentication → Providers** and enable **Email**.
2. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` (or your production URL) and add `http://localhost:3000/auth/callback` to **Redirect URLs**.
3. (Optional) Enable **GitHub** for “Continue with GitHub” — see [`docs/GITHUB_OAUTH_SETUP.md`](docs/GITHUB_OAUTH_SETUP.md).
4. Sign up at `/signup`, then sign in at `/login`.

**Protected routes** require login: `/settings/*`, `/research` (list), GET `/api/research`, GET `/api/leads/export`, all `/api/repos/*`, PATCH `/api/leads/[id]`, POST `/api/leads/discover`, POST `/api/research/analyze`, and POST `/api/optimize` (unless cron or `CRON_SECRET`).

**Public routes:** `/`, `/dashboard`, `/leads`, `/audit/[id]`, POST `/api/analytics`, POST `/api/audit-request`, GET `/api/audit-request/[id]`, GET `/api/leads`, GET `/api/research/[id]` (when linked to a visitor audit request or authenticated).

### 4. Run Locally

```bash
npm install
npm run dev
```

- **Landing page:** [http://localhost:3000](http://localhost:3000) — request a free audit via the CTA modal
- **Visitor audit:** `/audit/{requestId}` — public report with score, findings, competitors, and social presence
- **Lead pipeline:** [http://localhost:3000/leads](http://localhost:3000/leads) — discover London rank-3/4 prospects with auto-research
- **Agent dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard) — live brain log stream
- **Health check:** `GET /api/health` — `{ ok, supabase, anthropic }` for deploy verification
- **Manual optimize trigger:** `curl -X POST http://localhost:3000/api/optimize`

### 5. Deploy to Vercel

Link the repository to Vercel and add the same environment variables. A cron job in `vercel.json` fires `/api/optimize` every 15 minutes in production.

---

## 📁 Project Structure

```
app/
├── page.tsx                  # Public landing page + free audit modal
├── audit/[id]/page.tsx       # Visitor-facing audit report (score, findings, CTA)
├── leads/page.tsx            # London lead pipeline + analyze
├── research/                 # Full research audit list + detail
├── dashboard/page.tsx        # Showroom analytical dashboard
└── api/
    ├── analytics/route.ts    # Rate-limited analytics writes
    ├── audit-request/        # Free visitor audit flow
    ├── health/route.ts       # Deploy health check
    └── optimize/route.ts     # Edge CRO agent (LLM evaluation loop)
lib/
├── audit/                    # Visitor audit processing + scoring
├── email/send-audit-complete.ts  # Optional Resend notification
├── leads/auto-research.ts    # Auto-queue audits after discovery
├── rate-limit.ts             # In-memory sliding-window rate limiter
└── prompts/visitor-audit.ts  # Editable visitor report prompt
```

---

## 🧪 Verification Sequence

1. Run `npm run dev` and open the home page — confirm a `page_view` row appears in `analytics_events` (via `/api/analytics`).
2. Submit the free audit modal — confirm an `audit_requests` row and visit `/audit/{id}` (progress steps → full report).
3. Check deploy readiness: `curl http://localhost:3000/api/health`
4. Sign in and run lead discovery — confirm auto-research queues up to 5 audits per run (failed audits show “Audit failed” badge).
5. Trigger the agent: `curl -X POST http://localhost:3000/api/optimize`
6. Watch the landing page copy update live (no refresh needed) and new logs appear on `/dashboard`.

---

## ⚠️ Security Notes

- Analytics writes go through `POST /api/analytics` (service role); anon direct inserts are disabled.
- Free audit requests are rate-limited (5/hour per IP); analytics at 30/min per IP.
- In-memory rate limits are per server instance — see `lib/rate-limit.ts` for production caveats.
- Sensitive mutations require Supabase Auth at the middleware and API layer.
- Linked repositories are scoped per user (`user_id` on `linked_repositories`).
- Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or `ANTHROPIC_API_KEY`.
