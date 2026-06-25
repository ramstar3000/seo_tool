import type { SupabaseClient } from '@supabase/supabase-js';
import { runResearchAgent } from '@/lib/research/agent';
import {
  createPendingAudit,
  findAuditByLeadId,
  markAuditFailed,
  saveAuditToSupabase,
} from '@/lib/research/persist';

const MAX_AUTO_RESEARCH_PER_RUN = 5;

interface LeadForResearch {
  id: string;
  business_name: string;
  keyword: string;
  website_url: string;
  location: string | null;
}

export interface AutoResearchResult {
  queued: number;
  skipped: number;
  synced: number;
  failed: number;
  background: number;
}

async function runLeadResearch(supabase: SupabaseClient, lead: LeadForResearch): Promise<'completed' | 'skipped' | 'failed'> {
  const existing = await findAuditByLeadId(supabase, lead.id);
  if (existing?.status === 'completed') {
    await supabase.from('leads').update({ last_audit_id: existing.id }).eq('id', lead.id);
    return 'skipped';
  }

  let pendingAuditId: string | undefined;

  try {
    pendingAuditId = await createPendingAudit(supabase, {
      leadId: lead.id,
      targetUrl: lead.website_url,
      keyword: lead.keyword,
      businessName: lead.business_name,
    });

    const result = await runResearchAgent({
      targetUrl: lead.website_url,
      keyword: lead.keyword,
      businessName: lead.business_name,
      location: lead.location ?? 'London',
      leadId: lead.id,
    });

    await supabase.from('site_audits').delete().eq('id', pendingAuditId);

    const { auditId } = await saveAuditToSupabase(supabase, result);

    await supabase
      .from('leads')
      .update({ last_audit_id: auditId, updated_at: new Date().toISOString() })
      .eq('id', lead.id);

    return 'completed';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-research failed';
    console.error(`[auto-research] failed for lead ${lead.id} (${lead.business_name}):`, message);
    if (pendingAuditId) {
      await markAuditFailed(supabase, pendingAuditId, message);
    }
    return 'failed';
  }
}

async function collectEligibleLeads(
  supabase: SupabaseClient,
  leadIds: string[]
): Promise<LeadForResearch[]> {
  if (leadIds.length === 0) return [];

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, business_name, keyword, website_url, location, last_audit_id')
    .in('id', leadIds)
    .not('website_url', 'is', null);

  if (error || !leads?.length) return [];

  const eligible: LeadForResearch[] = [];

  for (const lead of leads) {
    if (!lead.website_url) continue;

    const existing = await findAuditByLeadId(supabase, lead.id);
    if (existing?.status === 'completed') {
      await supabase.from('leads').update({ last_audit_id: existing.id }).eq('id', lead.id);
      continue;
    }

    eligible.push({
      id: lead.id,
      business_name: lead.business_name,
      keyword: lead.keyword,
      website_url: lead.website_url,
      location: lead.location,
    });
  }

  return eligible;
}

/**
 * Queue research for leads with website URLs. Awaits up to maxPerRun audits;
 * remaining eligible leads run in the background (fire-and-forget).
 */
export async function queueAutoResearchForLeads(
  supabase: SupabaseClient,
  insertedLeadIds: string[],
  maxPerRun = MAX_AUTO_RESEARCH_PER_RUN
): Promise<AutoResearchResult> {
  const result: AutoResearchResult = { queued: 0, skipped: 0, synced: 0, failed: 0, background: 0 };

  const eligible = await collectEligibleLeads(supabase, insertedLeadIds);
  result.queued = eligible.length;
  result.skipped = insertedLeadIds.length - eligible.length;

  const syncBatch = eligible.slice(0, maxPerRun);
  const backgroundBatch = eligible.slice(maxPerRun);
  result.background = backgroundBatch.length;

  const syncResults = await Promise.allSettled(
    syncBatch.map((lead) => runLeadResearch(supabase, lead))
  );

  for (const settled of syncResults) {
    if (settled.status === 'fulfilled') {
      if (settled.value === 'completed') result.synced += 1;
      else if (settled.value === 'failed') result.failed += 1;
    } else {
      result.failed += 1;
      console.error('[auto-research] sync batch rejected:', settled.reason);
    }
  }

  if (backgroundBatch.length > 0) {
    void Promise.allSettled(backgroundBatch.map((lead) => runLeadResearch(supabase, lead))).then(
      (results) => {
        for (const settled of results) {
          if (settled.status === 'rejected') {
            console.error('[auto-research] background rejected:', settled.reason);
          } else if (settled.value === 'failed') {
            console.error('[auto-research] background audit failed for a lead');
          }
        }
      }
    );
  }

  return result;
}
