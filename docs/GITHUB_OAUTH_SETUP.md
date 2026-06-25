# GitHub OAuth setup for SynapseCRO

SynapseCRO uses Supabase Auth for “Continue with GitHub” on `/login`. No extra OAuth env vars are required in the Next.js app — the browser uses your Supabase anon key and Supabase handles the GitHub exchange.

## 1. Create a GitHub OAuth App

1. Open [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill in:
   - **Application name:** `SynapseCRO` (or your project name)
   - **Homepage URL:** `http://localhost:3000` (use your production URL when deployed)
   - **Authorization callback URL:**  
     `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`  
     Find `<YOUR-PROJECT-REF>` in Supabase → **Project Settings → General → Reference ID**.
4. Click **Register application**.
5. Copy the **Client ID**.
6. Click **Generate a new client secret** and copy the **Client secret** (shown once).

## 2. Enable GitHub in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication → Providers**.
3. Find **GitHub** and enable it.
4. Paste the **Client ID** and **Client secret** from step 1.
5. Save.

## 3. Configure redirect URLs

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to:
   - Local: `http://localhost:3000`
   - Production: `https://your-domain.com`
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback` (production)

SynapseCRO’s callback route (`app/auth/callback/route.ts`) exchanges the OAuth code for a session and redirects to the `next` path (default `/dashboard`).

## 4. Test locally

1. Run `npm run dev`.
2. Visit [http://localhost:3000/login](http://localhost:3000/login).
3. Click **Continue with GitHub**.
4. Authorize the app on GitHub.
5. You should land on `/dashboard` (or the page you were redirected from).

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Redirect to `/login?error=auth_callback_failed` | Callback URL mismatch — verify GitHub OAuth app callback is `https://<ref>.supabase.co/auth/v1/callback` and Supabase redirect URLs include `/auth/callback`. |
| “OAuth provider not enabled” | Enable GitHub under Supabase **Authentication → Providers**. |
| GitHub shows “redirect_uri mismatch” | The callback URL in the GitHub OAuth app must exactly match Supabase’s callback (`https://<ref>.supabase.co/auth/v1/callback`). |
| Works locally but not in production | Update GitHub OAuth app homepage + Supabase **Site URL** and **Redirect URLs** to your production domain. |

## Security notes

- Never put the GitHub client secret in `.env.local` for the Next.js app — Supabase stores it server-side.
- The anon key is safe for the browser; session cookies are managed by Supabase SSR middleware.
