import type { SupabaseClient } from '@supabase/supabase-js';
import { runLightLeadAudit } from '@/lib/leads/light-audit';
import { saveLightAuditToSupabase } from '@/lib/leads/persist-light-audit';
import { findAuditByLeadId } from '@/lib/research/persist';

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

async function runLeadLightScan(
  supabase: SupabaseClient,
  lead: LeadForResearch
): Promise<'completed' | 'skipped' | 'failed'> {
  const existing = await findAuditByLeadId(supabase, lead.id);
  if (existing?.status === 'completed') {
    await supabase.from('leads').update({ last_audit_id: existing.id }).eq('id', lead.id);
    return 'skipped';
  }

  try {
    const result = await runLightLeadAudit({
      businessName: lead.business_name,
      keyword: lead.keyword,
      websiteUrl: lead.website_url,
      location: lead.location ?? 'London',
    });

    await saveLightAuditToSupabase(supabase, lead.id, result);
    return 'completed';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Light SERP scan failed';
    console.error(`[auto-research] light scan failed for lead ${lead.id} (${lead.business_name}):`, message);
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
 * Queue a Tavily-only SERP scan for new leads (no LLM, no crawl).
 * Awaits up to maxPerRun scans; remaining eligible leads run in the background.
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
    syncBatch.map((lead) => runLeadLightScan(supabase, lead))
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
    void Promise.allSettled(backgroundBatch.map((lead) => runLeadLightScan(supabase, lead))).then(
      (results) => {
        for (const settled of results) {
          if (settled.status === 'rejected') {
            console.error('[auto-research] background rejected:', settled.reason);
          } else if (settled.value === 'failed') {
            console.error('[auto-research] background light scan failed for a lead');
          }
        }
      }
    );
  }

  return result;
}
