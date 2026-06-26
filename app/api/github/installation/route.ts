import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  deleteInstallationForUser,
  getInstallationForUser,
} from '@/lib/github/installations';
import { hasGitHubAppConfig } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const installation = await getInstallationForUser(auth.user.id);

  return NextResponse.json({
    connected: Boolean(installation),
    githubAppConfigured: hasGitHubAppConfig(),
    installation: installation
      ? {
          installation_id: installation.installation_id,
          account_login: installation.account_login,
          account_type: installation.account_type,
        }
      : null,
  });
}

export async function DELETE() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  try {
    await deleteInstallationForUser(auth.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect GitHub App';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
