import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { isAdminEmail } from '@/lib/auth/admin-email';

export { isAdminEmail, ADMIN_EMAIL_DOMAIN } from '@/lib/auth/admin-email';

type RequireAdminResult =
  | Exclude<Awaited<ReturnType<typeof requireUser>>, { error: NextResponse }>
  | { error: NextResponse };

/**
 * Like requireUser(), but additionally requires the user's email to be on the
 * admin domain. Returns 403 for authenticated-but-not-admin users.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const auth = await requireUser();
  if ('error' in auth) return auth;

  if (!isAdminEmail(auth.user.email)) {
    return {
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return auth;
}
