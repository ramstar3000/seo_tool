/** Client-safe admin-identity helpers (no server imports). */

/** Admins are identified by an @acyclic.dev email address. */
export const ADMIN_EMAIL_DOMAIN = 'acyclic.dev';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}
