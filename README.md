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

### 3. Authentication (Supabase)

1. In the [Supabase dashboard](https://supabase.com/dashboard), open **Authentication → Providers** and enable **Email**.
2. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` (or your production URL) and add `http://localhost:3000/auth/callback` to **Redirect URLs**.
3. (Optional) Enable **GitHub** provider for “Continue with GitHub” on the login page.
4. Sign up at `/signup`, then sign in at `/login`.

**Protected routes** require login: `/settings/*`, `/research/*`, all `/api/repos/*`, POST `/api/research/analyze`, PATCH `/api/leads/[id]`, POST `/api/leads/discover`, and POST `/api/optimize` (unless called by Vercel cron or `Authorization: Bearer $CRON_SECRET`).

**Public demo routes** stay open: `/`, `/dashboard`, `/leads`, `/seo-guide`, GET `/api/leads`, GET `/api/research`.

### 4. Run Locally

```bash
npm install
npm run dev
```

- **Landing page:** [http://localhost:3000](http://localhost:3000) — click the CTA a few times to seed analytics
- **Agent dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard) — live brain log stream
- **Manual optimize trigger:** `curl -X POST http://localhost:3000/api/optimize`

### 5. Deploy to Vercel

Link the repository to Vercel and add the same environment variables. A cron job in `vercel.json` fires `/api/optimize` every 15 minutes in production.

---

## 📁 Project Structure

```
app/
├── page.tsx              # Public living landing page (realtime copy)
├── dashboard/page.tsx    # Showroom analytical dashboard
└── api/optimize/route.ts # Edge CRO agent (LLM evaluation loop)
supabase/schema.sql       # Database schema + RLS + Realtime
vercel.json               # 15-minute autonomous cron
```

---

## 🧪 Verification Sequence

1. Run `npm run dev` and open the home page — confirm a `page_view` row appears in `analytics_events`.
2. Click the CTA several times — confirm `cta_click` rows accumulate.
3. Trigger the agent: `curl -X POST http://localhost:3000/api/optimize`
4. Watch the landing page copy update live (no refresh needed) and new logs appear on `/dashboard`.

---

## ⚠️ Security Notes

- Row Level Security policies restrict anon users to read copy/logs and insert analytics events only.
- Sensitive mutations (research analyze, repo linking, PR creation, lead updates) require Supabase Auth at the middleware and API layer.
- Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or `ANTHROPIC_API_KEY`.
