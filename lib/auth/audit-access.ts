import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export async function isAuditPubliclyAccessible(
  supabase: SupabaseClient,
  auditId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('audit_requests')
    .select('id')
    .eq('site_audit_id', auditId)
    .maybeSingle();

  return Boolean(data);
}

export async function canAccessAudit(
  supabase: SupabaseClient,
  auditId: string,
  user: User | null
): Promise<boolean> {
  if (user) return true;
  return isAuditPubliclyAccessible(supabase, auditId);
}
