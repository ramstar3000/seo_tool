# Hackathon sponsor usage — SynapseCRO

**Event:** Cursor Hands-Off Hackathon — London  
**Live app:** [https://synapsecro.fly.dev](https://synapsecro.fly.dev)

---

## ClickHouse

**Role:** Agent memory + conversion analytics (not a sidecar dashboard).

### What we built

1. **Sensory stream** — visitor events dual-written to `analytics_events`; hourly MV powers the CRO cron; `/api/optimize` reads 30-day `countIf` conversion metrics before rewriting copy.

2. **Cognitive memory** — audit ingests → `seo_insight_events`; aggregations for persistent issues, rank/LCP trajectory, category heatmaps; `getSeoPromptContext()` feeds GitHub PR and `?leadId=` optimize prompts.

3. **Closed loop** — `agent_loop_events` (optimize + audit ingests), `llm_eval_events` (eval scores for SQL analytics).

**Langfuse** (ClickHouse ecosystem): OTEL traces on every LLM call + business eval scores mirrored to ClickHouse.

### Demo

| URL | What |
|-----|------|
| [/clickhouse](https://synapsecro.fly.dev/clickhouse) | Judge showcase page |
| [/api/clickhouse/showcase](https://synapsecro.fly.dev/api/clickhouse/showcase) | One-shot JSON demo |
| [/api/analytics/metrics](https://synapsecro.fly.dev/api/analytics/metrics) | `"source": "clickhouse"` |

**Key code:** `lib/clickhouse/`, `docs/CLICKHOUSE.md`

> “Postgres stores the audit. ClickHouse remembers *patterns* — which issues survived re-audits, how CVR moved hour-by-hour — and feeds that into the rewrite agent.”

---

## DeepMind (Gemini)

**Model in prod:** `gemini-2.5-flash` via `@ai-sdk/google`

| Workflow | Where |
|----------|--------|
| SEO research agent (tool loop) | `lib/research/agent.ts` |
| Findings synthesis | `lib/research/agent.ts` |
| CRO copy rewrite | `/api/optimize` → `lib/llm/providers.ts` |
| GitHub PR edits | `lib/github/apply-findings.ts` |
| Research quality judge | `lib/langfuse/research-eval.ts` |

All LLM calls go through `lib/llm/generate.ts` with spend caps and usage tracking.

**Verify:** `/api/health` → `llmProvider: "gemini"`

---

## Tavily

**Role:** Live SERP and discovery — no mock search data when the key is set.

| Feature | Where |
|---------|--------|
| Lead discovery (London rank-3/4) | `lib/leads/discover.ts` |
| Organic SERP / competitors | `lib/research/serp.ts` |
| Social presence search | `lib/research/social-presence.ts` |
| Agent tools | `lib/research/agent-tools.ts` |

**Demo:** [/leads](https://synapsecro.fly.dev/leads) → Discover leads → run audit with real competitors.

**Verify:** `/api/health` → `tavily: true`

---

## Cursor

**Role:** Built the entire submission in Cursor — app, ClickHouse layer, Langfuse OTEL, Fly deploy, outreach pipeline.

The product matches the hackathon theme: **hands-off** autonomous agent (cron optimize, auto-research on discovery, realtime copy updates) while founders are away from the keyboard.
