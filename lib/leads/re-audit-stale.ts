import type { SupabaseClient } from '@supabase/supabase-js';
import { runAndPersistLeadAudit } from '@/lib/audit/process-request';

const STALE_DAYS = 7;
export const MAX_REAUDIT_PER_RUN = 3;

interface StaleLead {
  id: string;
  business_name: string;
  keyword: string;
  website_url: string;
  location: string | null;
  last_audit_id: string | null;
}

export async function findStaleLeadsForReaudit(
  supabase: SupabaseClient,
  limit = MAX_REAUDIT_PER_RUN
): Promise<StaleLead[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, business_name, keyword, website_url, location, last_audit_id')
    .not('website_url', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(50);

  if (error || !leads?.length) {
    return [];
  }

  const stale: StaleLead[] = [];

  for (const lead of leads) {
    if (!lead.website_url) continue;

    if (!lead.last_audit_id) {
      stale.push(lead as StaleLead);
      if (stale.length >= limit) break;
      continue;
    }

    const { data: audit } = await supabase
      .from('site_audits')
      .select('completed_at, status')
      .eq('id', lead.last_audit_id)
      .maybeSingle();

    if (!audit?.completed_at || audit.status !== 'completed') {
      stale.push(lead as StaleLead);
      if (stale.length >= limit) break;
      continue;
    }

    if (audit.completed_at < cutoff) {
      stale.push(lead as StaleLead);
      if (stale.length >= limit) break;
    }
  }

  return stale;
}

export async function reauditStaleLeads(
  supabase: SupabaseClient,
  maxPerRun = MAX_REAUDIT_PER_RUN
): Promise<{ processed: number; auditIds: string[]; errors: string[] }> {
  const leads = await findStaleLeadsForReaudit(supabase, maxPerRun);
  const auditIds: string[] = [];
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const auditId = await runAndPersistLeadAudit(
        supabase,
        {
          leadId: lead.id,
          targetUrl: lead.website_url,
          keyword: lead.keyword,
          businessName: lead.business_name,
          location: lead.location ?? 'London',
        },
        { force: true }
      );
      auditIds.push(auditId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Re-audit failed';
      errors.push(`${lead.business_name}: ${message}`);
    }
  }

  return { processed: auditIds.length, auditIds, errors };
}
