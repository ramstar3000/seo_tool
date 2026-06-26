# GitHub App setup for SynapseCRO

SynapseCRO uses a **GitHub App** for repository access (branches, contents, pull requests). Each user installs the app on their account or organization; the server exchanges short-lived **installation tokens** per request. A shared `GITHUB_TOKEN` PAT remains supported as a fallback for local dev.

This is separate from **Supabase GitHub OAuth** used for login — see [`GITHUB_OAUTH_SETUP.md`](./GITHUB_OAUTH_SETUP.md). Do not reuse the OAuth App credentials here.

## 1. Register the GitHub App

1. Open [GitHub → Settings → Developer settings → GitHub Apps](https://github.com/settings/apps) (or your org’s **Developer settings** for an org-owned app).
2. Click **New GitHub App**.
3. Fill in:

| Field | Value |
|-------|--------|
| **GitHub App name** | `SynapseCRO` (or your choice) |
| **Homepage URL** | `https://your-domain.com` (local: `http://localhost:3000`) |
| **Callback URL** | Leave blank (not used for install flow) |
| **Setup URL** | `https://your-domain.com/api/github/callback` |
| **Webhook URL** | `https://your-domain.com/api/github/webhook` |
| **Webhook secret** | Generate a random string → `GITHUB_APP_WEBHOOK_SECRET` |
| **Expire user authorization tokens** | Unchecked (we use installation tokens) |
| **Request user authorization (OAuth) during installation** | Unchecked |
| **Where can this GitHub App be installed?** | Any account (or restrict to your org) |

4. Under **Repository permissions**:

| Permission | Access |
|------------|--------|
| **Contents** | Read and write |
| **Pull requests** | Read and write |
| **Metadata** | Read-only (automatic) |

5. **Subscribe to events** (webhook):

- `Installation`
- `Installation repositories` (optional, Phase 2)

6. Click **Create GitHub App**.

7. Note the **App ID** → `GITHUB_APP_ID`.

8. Note the app slug from the public URL (`https://github.com/apps/{slug}`) → `GITHUB_APP_SLUG`.

9. Generate a **Private key** (PEM). Download once. Set as `GITHUB_APP_PRIVATE_KEY` (see env section below).

## 2. Environment variables

Add to `.env.local` (and Fly secrets in production):

```bash
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=synapsecro
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret   # optional locally; recommended in prod
```

**Private key in env:** Paste the PEM with literal newlines, or use `\n` escapes on one line (the app normalizes `\\n` → newline).

**Optional PAT fallback** (single-tenant / local dev):

```bash
GITHUB_TOKEN=ghp_...
```

## 3. User install flow

1. User signs in to SynapseCRO.
2. Opens **Settings → Linked repositories** (`/settings/repos`).
3. Clicks **Connect GitHub App** → `GET /api/github/install` (auth required).
4. GitHub install UI → user selects repos (all or selected).
5. GitHub redirects to **Setup URL** → `GET /api/github/callback?installation_id=…&setup_action=install&state=…`.
6. Server verifies signed `state`, stores row in `github_installations`, redirects to `/settings/repos?connected=1`.

Install state is HMAC-signed with `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Webhook

`POST /api/github/webhook` handles:

- `installation` / `deleted` — removes `github_installations` row, clears token cache.
- `installation` / `created` — refreshes metadata if installation already known (new installs are saved via callback).

If `GITHUB_APP_WEBHOOK_SECRET` is unset, signature verification is skipped (local dev only).

## 5. Database

Fresh projects: `supabase/schema.sql` includes `github_installations` and `linked_repositories.installation_id`.

Existing projects: run:

```bash
# supabase/migrations/20250626_github_installations.sql
```

## 6. Test locally

1. Use [smee.io](https://smee.io/) or `ngrok` to forward webhooks to `http://localhost:3000/api/github/webhook` if testing deletes.
2. Set env vars and restart `npm run dev`.
3. Sign in → `/settings/repos` → **Connect GitHub App**.
4. Link a repo from a research report and create a PR from audit findings.

## 7. Production (Fly.io)

```bash
fly secrets set \
  GITHUB_APP_ID=... \
  GITHUB_APP_SLUG=... \
  GITHUB_APP_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----' \
  GITHUB_APP_WEBHOOK_SECRET=...
```

Update the GitHub App **Setup URL** and **Webhook URL** to your Fly hostname (e.g. `https://synapsecro.fly.dev/api/github/callback`).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| “GitHub App is not configured” | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` all set |
| Install redirect works but PR fails | App installed on repo owner; repo selected in install scope |
| `invalid_state` on callback | Clock skew; state older than 15 minutes; re-click Connect |
| Webhook 401 | `GITHUB_APP_WEBHOOK_SECRET` matches GitHub App settings |

## Related docs

- [`GITHUB_OAUTH_SETUP.md`](./GITHUB_OAUTH_SETUP.md) — login OAuth (Supabase), unchanged by this feature.
