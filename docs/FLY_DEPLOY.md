# Deploy SynapseCRO to Fly.io

## Prerequisites

1. [Fly.io account](https://fly.io/app/sign-up)
2. [Fly CLI](https://fly.io/docs/flyctl/install/):

   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

3. Supabase schema applied (`supabase/schema.sql`) — already done if `node scripts/diagnose-db.mjs` passes.

---

## 1. Create the app (first time only)

```bash
fly apps create synapsecro
```

If the name is taken, edit `app = '...'` in `fly.toml` and use your name.

---

## 2. Set secrets

Runtime secrets (never commit these):

```bash
# Import everything from local .env (URL, keys, Resend, Anthropic, etc.)
fly secrets import < .env

# Cron auth — required for scheduled /api/optimize and /api/cron/re-audit-leads
fly secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

**Minimum required secrets:**

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database + auth (also used as build secret) |
| `SUPABASE_PUBLISHABLE_KEY` | Client auth (also build secret) |
| `SUPABASE_SECRET_KEY` | Server-side writes |
| `GEMINI_API_KEY` | Research agent + CRO optimize (primary) |
| `ANTHROPIC_API_KEY` | Fallback LLM if Gemini is not set |
| `CRON_SECRET` | Scheduled job auth on Fly |
| `RESEND_API_KEY` | Audit completion emails |
| `RESEND_FROM_EMAIL` | e.g. `SynapseCRO <hello@graphcoder.ai>` |

**Optional:** `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `GITHUB_TOKEN`, `GOOGLE_PAGESPEED_API_KEY`, `SLACK_WEBHOOK_URL`

**ClickHouse analytics (optional — hackathon / prod analytics):**

| Secret | Purpose |
|--------|---------|
| `CLICKHOUSE_URL` | Cloud HTTPS endpoint (`https://….clickhouse.cloud:8443`) |
| `CLICKHOUSE_USER` | Usually `default` |
| `CLICKHOUSE_PASSWORD` | Database password (from Connect tab or `npm run clickhouse:cloud-provision`) |
| `CLICKHOUSE_DATABASE` | Usually `default` |

Local provisioning (writes DB creds to `.env`; import to Fly afterward):

```bash
npm run clickhouse:cloud-provision   # uses CLICKHOUSE_KEY_ID + CLICKHOUSE_API_KEY
npm run clickhouse:init
fly secrets import < <(grep '^CLICKHOUSE_' .env)
fly deploy
curl -s https://synapsecro.fly.dev/api/health | jq '.config.clickhouse, .config.clickhouseOk'
```

See [`docs/CLICKHOUSE.md`](CLICKHOUSE.md) for local Docker smoke tests.

**Langfuse (optional — LLM traces + eval scores):**

| Secret | Purpose |
|--------|---------|
| `LANGFUSE_PUBLIC_KEY` | From [cloud.langfuse.com](https://cloud.langfuse.com) → Settings → API Keys |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_BASE_URL` | Optional (`https://cloud.langfuse.com` or US region) |

```bash
fly secrets set LANGFUSE_PUBLIC_KEY=pk-lf-... LANGFUSE_SECRET_KEY=sk-lf-...
curl -s https://synapsecro.fly.dev/api/health | jq '.config.langfuse'
```

**App URL:** Fly sets `FLY_APP_NAME` automatically. Audit emails use `https://{app}.fly.dev` unless you set `NEXT_PUBLIC_APP_URL`.

List secrets (names only):

```bash
fly secrets list
```

---

## 3. Deploy

```bash
fly deploy
```

Fly passes `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as **build secrets** so the Next.js client bundle includes auth config.

Open the app:

```bash
fly open
```

Verify:

```bash
curl -s https://synapsecro.fly.dev/api/health | jq
# expect: "schema": true, "supabase": true
# with ClickHouse secrets: "clickhouse": true, "clickhouseOk": true
```

---

## 4. Supabase auth redirects

In [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/gvrnvybxqqzfmzzulods/auth/url-configuration):

- **Site URL:** `https://synapsecro.fly.dev` (or your custom domain)
- **Redirect URLs:** add
  ```
  https://synapsecro.fly.dev/auth/callback
  http://localhost:3000/auth/callback
  ```

---

## 5. Cron jobs (replaces Vercel crons)

Vercel crons do not run on Fly. Use one of these:

### Option A — GitHub Actions (recommended)

Add repo secrets:

- `CRON_SECRET` — same value as Fly
- `FLY_APP_URL` — `https://synapsecro.fly.dev`

The workflow `.github/workflows/fly-cron.yml` hits:

- `POST /api/optimize` every 15 minutes
- `GET /api/cron/re-audit-leads` Mondays 09:00 UTC

### Option B — External cron (cron-job.org, etc.)

Every 15 minutes:

```bash
curl -X POST "https://synapsecro.fly.dev/api/optimize" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Weekly (Mondays 09:00 UTC):

```bash
curl "https://synapsecro.fly.dev/api/cron/re-audit-leads" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Manual test

```bash
fly secrets list   # confirm CRON_SECRET is set
curl -X POST "https://synapsecro.fly.dev/api/optimize" \
  -H "Authorization: Bearer $(fly ssh console -C 'printenv CRON_SECRET' 2>/dev/null || echo 'paste-secret-here')"
```

Or read `CRON_SECRET` from your password manager and curl locally.

---

## 6. Useful commands

```bash
fly logs              # live logs
fly status            # machine state
fly ssh console       # shell into VM
fly secrets list      # secret names (not values)
fly deploy            # redeploy after code changes
fly scale memory 1024 # if audits OOM
```

---

## 7. Custom domain (optional)

```bash
fly certs add synapsecro.graphcoder.ai
```

Add the DNS records Fly shows, then set `NEXT_PUBLIC_APP_URL=https://synapsecro.graphcoder.ai` and update Supabase redirect URLs.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails — missing Supabase in client | Ensure `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` are Fly secrets before `fly deploy` |
| `schema: false` on `/api/health` | Run `supabase/schema.sql` on your Supabase project |
| Auth redirect fails | Add `https://YOUR_APP.fly.dev/auth/callback` in Supabase |
| Cron 401 | Set `CRON_SECRET` on Fly; use `Authorization: Bearer ...` header |
| Audit timeouts | `fly scale memory 1024` or `2048` — research agent is memory-heavy |
| `clickhouse: false` on `/api/health` | Set `CLICKHOUSE_URL` + `CLICKHOUSE_PASSWORD` on Fly and redeploy |
| ClickHouse ping fails in prod | Wake idle service: `curl https://YOUR_HOST.clickhouse.cloud:8443/ping` |
