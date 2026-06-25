import type { NextRequest } from 'next/server';
import { isCronAuthorized } from '@/lib/auth/cron-auth';
import { requireUser } from '@/lib/auth/require-user';

export async function requireUserOrCron(request: NextRequest) {
  if (isCronAuthorized(request)) {
    return { authorized: true as const, via: 'cron' as const };
  }

  const auth = await requireUser();
  if ('error' in auth) {
    return { authorized: false as const, error: auth.error };
  }

  return { authorized: true as const, via: 'user' as const, user: auth.user, supabase: auth.supabase };
}
