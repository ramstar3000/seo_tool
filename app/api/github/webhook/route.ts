import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGitHubAppWebhookSecret } from '@/lib/env';
import { invalidateInstallationToken } from '@/lib/github/app-auth';
import {
  deleteInstallation,
  fetchInstallationFromGitHub,
  getInstallationByInstallationId,
  saveInstallation,
} from '@/lib/github/installations';

export const runtime = 'nodejs';

interface WebhookInstallation {
  id: number;
  account?: {
    login?: string;
    type?: 'User' | 'Organization';
  };
}

interface WebhookPayload {
  action?: string;
  installation?: WebhookInstallation;
}

function verifyWebhookSignature(body: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected =
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  try {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const webhookSecret = getGitHubAppWebhookSecret();

  if (webhookSecret) {
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = request.headers.get('x-github-event');
  const installationId = payload.installation?.id;

  if (!installationId) {
    return NextResponse.json({ ok: true });
  }

  if (event === 'installation' && payload.action === 'deleted') {
    invalidateInstallationToken(installationId);
    try {
      await deleteInstallation(installationId);
    } catch (err) {
      console.error('[github/webhook] delete installation failed:', err);
    }
    return NextResponse.json({ ok: true });
  }

  if (event === 'installation' && payload.action === 'created') {
    const existing = await getInstallationByInstallationId(installationId);
    if (!existing) {
      // New installs are persisted via GET /api/github/callback after user redirect.
      return NextResponse.json({ ok: true });
    }

    try {
      const meta = await fetchInstallationFromGitHub(installationId);
      await saveInstallation({
        userId: existing.user_id,
        installationId,
        accountLogin: payload.installation?.account?.login ?? meta.account_login,
        accountType: payload.installation?.account?.type ?? meta.account_type,
      });
    } catch (err) {
      console.warn('[github/webhook] installation.created refresh failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
