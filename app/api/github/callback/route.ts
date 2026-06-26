import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getAppBaseUrl } from '@/lib/env';
import {
  fetchInstallationFromGitHub,
  saveInstallation,
} from '@/lib/github/installations';
import { verifyInstallState } from '@/lib/github/install-state';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const { searchParams } = request.nextUrl;
  const installationIdRaw = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');
  const state = searchParams.get('state');

  const redirectBase = new URL('/settings/repos', getAppBaseUrl());
  redirectBase.searchParams.set('connected', '1');

  if (!installationIdRaw) {
    redirectBase.searchParams.set('error', 'missing_installation_id');
    return NextResponse.redirect(redirectBase.toString());
  }

  const installationId = Number(installationIdRaw);
  if (!Number.isFinite(installationId) || installationId <= 0) {
    redirectBase.searchParams.set('error', 'invalid_installation_id');
    return NextResponse.redirect(redirectBase.toString());
  }

  if (state) {
    const userIdFromState = verifyInstallState(state);
    if (!userIdFromState || userIdFromState !== auth.user.id) {
      redirectBase.searchParams.set('error', 'invalid_state');
      return NextResponse.redirect(redirectBase.toString());
    }
  }

  if (setupAction === 'request') {
    // User started install but has not completed org approval yet.
    redirectBase.searchParams.delete('connected');
    redirectBase.searchParams.set('pending', '1');
    return NextResponse.redirect(redirectBase.toString());
  }

  try {
    const meta = await fetchInstallationFromGitHub(installationId);
    await saveInstallation({
      userId: auth.user.id,
      installationId,
      accountLogin: meta.account_login,
      accountType: meta.account_type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save installation';
    redirectBase.searchParams.delete('connected');
    redirectBase.searchParams.set('error', message.slice(0, 200));
    return NextResponse.redirect(redirectBase.toString());
  }

  return NextResponse.redirect(redirectBase.toString());
}
