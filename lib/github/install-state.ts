import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseServiceRoleKey } from '@/lib/env';

const STATE_TTL_MS = 15 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.CRON_SECRET ?? getSupabaseServiceRoleKey();
  if (!secret) {
    throw new Error('Cannot sign GitHub install state: set CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }
  return secret;
}

/** Signed state payload for GitHub App install redirect (user_id.timestamp.sig). */
export function signInstallState(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}`;
  const signature = createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyInstallState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [userId, timestamp, signature] = parts;
  if (!userId || !timestamp || !signature) {
    return null;
  }

  const payload = `${userId}.${timestamp}`;
  const expected = createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) {
    return null;
  }

  return userId;
}
