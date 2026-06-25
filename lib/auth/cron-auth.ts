import type { NextRequest } from 'next/server';

export function isCronAuthorized(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${cronSecret}`;
}
