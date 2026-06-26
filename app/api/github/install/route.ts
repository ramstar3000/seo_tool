import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getGitHubAppSlug, hasGitHubAppConfig } from '@/lib/env';
import { signInstallState } from '@/lib/github/install-state';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  if (!hasGitHubAppConfig()) {
    return NextResponse.json(
      { error: 'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG.' },
      { status: 503 }
    );
  }

  const slug = getGitHubAppSlug();
  if (!slug) {
    return NextResponse.json({ error: 'GITHUB_APP_SLUG is not configured' }, { status: 503 });
  }

  const state = signInstallState(auth.user.id);
  const installUrl = new URL(`https://github.com/apps/${slug}/installations/new`);
  installUrl.searchParams.set('state', state);

  return NextResponse.redirect(installUrl.toString());
}
