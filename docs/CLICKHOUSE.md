# ClickHouse — Sensory analytics + SEO cognitive memory for SynapseCRO

ClickHouse powers two hackathon use cases:

1. **Sensory stream** — high-frequency visitor events → conversion metrics for the CRO agent
2. **Cognitive memory** — SEO audit findings ingested over time → aggregated context for continual prompt engineering (GitHub PR edits, optional CRO optimize)

Postgres (Supabase) remains the source of truth for auth, leads, and realtime copy; ClickHouse handles fast aggregations.

## Why ClickHouse here

| Workload | Before | With ClickHouse |
|----------|--------|-----------------|
| Conversion rate for `/api/optimize` | Full-table scan in Postgres | `countIf()` over 30 days in milliseconds |
| Dashboard funnel | Totals only | Hourly `GROUP BY` over 7 days |
| API spend rollups | Row-by-row sum in Postgres | Columnar `sum()` by provider |
| SEO insight memory | Per-audit Postgres rows only | Cross-audit trends, recurring findings, rank history |

## Local development (Docker, free)

No ClickHouse Cloud account required. Uses plain HTTP on port **8123** (Cloud uses HTTPS **8443**).

1. Start ClickHouse:

```bash
npm run clickhouse:up
# equivalent: docker compose -f docker-compose.clickhouse.yml up -d
```

2. Add to `.env.local` (or export for one-off commands):

```bash
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=default
```

3. Run the smoke test (initializes tables, inserts sample rows, queries metrics — **Next.js not required**):

```bash
npm run clickhouse:smoke
```

4. With `npm run dev` running, dual-write paths use the same env vars:

```bash
curl http://localhost:3000/api/health | jq '.config.clickhouse, .config.clickhouseOk'
curl http://localhost:3000/api/analytics/metrics | jq '.source, .totals'
curl http://localhost:3000/api/seo/insights/metrics | jq '.auditCount, .source'
```

5. Stop when done:

```bash
npm run clickhouse:down
```


The Docker compose file mounts `docker/clickhouse/users.d/local-default.xml` so the `default` user accepts an empty password on localhost.

**Docker not installed?** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or run ClickHouse another way and point `CLICKHOUSE_URL` at it. The smoke script will fail fast with start instructions if nothing is listening on the URL.

---

## Setup (ClickHouse Cloud free tier)

1. Create a free [ClickHouse Cloud](https://clickhouse.com/cloud) service.
2. Copy connection details from **Connect → Node.js**.
3. Add to `.env.local`:

```bash
CLICKHOUSE_URL=https://YOUR_HOST.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
# optional — defaults to "default"
# CLICKHOUSE_DATABASE=default
```

4. Initialize tables (auto-created on first write, or run manually):

```bash
node scripts/clickhouse-init.mjs
# optional: copy existing Supabase analytics rows
node scripts/clickhouse-init.mjs --backfill
```

5. Verify:

```bash
curl http://localhost:3000/api/health | jq '.config.clickhouse, .config.clickhouseOk, .config.seoInsights'
curl http://localhost:3000/api/analytics/metrics | jq '.source, .totals'
curl http://localhost:3000/api/seo/insights/metrics | jq '.auditCount, .byCategory'
```

## Data flow

```
Homepage /api/analytics POST
  ├─► Supabase analytics_events (realtime + legacy)
  └─► ClickHouse analytics_events (aggregations)

saveAuditToSupabase (all audit paths)
  └─► ClickHouse seo_insight_events (audit_summary + finding rows)

recordApiUsage()
  ├─► Supabase api_usage_events
  └─► ClickHouse api_usage_events

/api/optimize (CRO agent)
  ├─► ClickHouse countIf(page_view, cta_click) when configured
  └─► Optional ?leadId=… → SEO prompt context from ClickHouse

GitHub PR / auto-apply-from-audit
  └─► getSeoPromptContext({ leadId, auditId }) → buildGitHubChangesUserPrompt

/dashboard
  ├─► GET /api/analytics/metrics → hourly funnel
  └─► GET /api/seo/insights/metrics → category breakdown + recent findings
```

## SEO insight architecture

When any audit completes (`saveAuditToSupabase`), the app dual-writes to `seo_insight_events`:

| Row type | Fields |
|----------|--------|
| `audit_summary` | severity counts, finding_count, rank_position (from lead), summary/recommendations snippets |
| `finding` | severity, category, title, truncated description |

**Read paths:**

- `getSeoPromptContext({ leadId?, auditId?, keyword?, days? })` — LLM-ready block with recurring findings, rank history, trend language
- `GET /api/seo/insights` — full aggregated JSON (prompt block included)
- `GET /api/seo/insights/metrics` — dashboard-friendly counts and category breakdown

**Prompt engineering:**

- `lib/prompts/github-changes.ts` — optional `seoContext` block
- `lib/prompts/cro-optimizer.ts` — optional `seoContext` when `/api/optimize?leadId=…`

Without `CLICKHOUSE_*` env vars, all paths fall back gracefully (Postgres-only audits unchanged).

## Hackathon demo script

### Sensory stream (CRO)

1. Show `/dashboard` **ClickHouse analytics** badge after env is set.
2. Visit `/` and click the CTA a few times.
3. Refresh dashboard — hourly funnel bars update.
4. Trigger optimize: `curl -X POST "http://localhost:3000/api/optimize" -H "Authorization: Bearer $CRON_SECRET"`
5. Show agent decision used ClickHouse-backed conversion metrics.

### Cognitive memory (SEO)

1. Run a lead audit or visitor audit (or re-audit cron) — findings land in ClickHouse automatically.
2. `curl http://localhost:3000/api/seo/insights/metrics | jq` — show audit/finding counts.
3. Open `/dashboard` — **SEO insight memory** section with category breakdown.
4. Link a GitHub repo and trigger auto-PR — LLM prompt includes historical SEO context from ClickHouse.
5. Optional: `curl -X POST "http://localhost:3000/api/optimize?leadId=LEAD_UUID" …` — CRO agent sees SEO memory for that lead.

## Tables

See `lib/clickhouse/schema.ts` for DDL. All tables use `MergeTree`, monthly partitions, and 365-day TTL.

| Table | Purpose |
|-------|---------|
| `analytics_events` | page_view, cta_click |
| `api_usage_events` | provider spend rollups |
| `seo_insight_events` | audit summaries + individual findings |
