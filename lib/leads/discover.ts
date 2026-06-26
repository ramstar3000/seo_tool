import type { SupabaseClient } from '@supabase/supabase-js';
import { getTavilyApiKey } from '@/lib/env';
import { findKeywordTemplate, getLondonKeywordStrings, LONDON_KEYWORDS } from '@/lib/leads/keywords';
import { LONDON_SEED_LEADS } from '@/lib/leads/london-seed-leads';
import { scoreLead } from '@/lib/leads/scoring';
import type { DiscoverResult, LeadInsert } from '@/lib/leads/types';
import { fetchSerpLeadsForKeyword } from '@/lib/research/serp';

const SEED_BY_KEYWORD = new Map(
  LONDON_SEED_LEADS.map((lead) => [`${lead.business_name}::${lead.keyword}`, lead])
);

function enrichLead(lead: LeadInsert): LeadInsert {
  const seedMatch = SEED_BY_KEYWORD.get(`${lead.business_name}::${lead.keyword}`);

  return {
    ...lead,
    location: lead.location ?? 'London',
    lead_score: lead.lead_score ?? scoreLead(lead.rank_position, Boolean(lead.website_url)),
    status: lead.status ?? 'new',
    recommendation: lead.recommendation ?? seedMatch?.recommendation ?? null,
  };
}

async function fetchTavilyLeads(keyword: string): Promise<LeadInsert[]> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return [];

  const template = findKeywordTemplate(keyword);
  const serpLeads = await fetchSerpLeadsForKeyword(keyword, [3, 4]);

  return serpLeads.map((result) =>
    enrichLead({
      business_name: result.business_name,
      category: template?.category ?? null,
      location: template?.location ?? 'London',
      keyword,
      rank_position: result.rank_position as 3 | 4,
      website_url: result.website_url,
    })
  );
}

async function discoverFromTavily(): Promise<LeadInsert[]> {
  const keywords = getLondonKeywordStrings();
  const allLeads: LeadInsert[] = [];

  for (const keyword of keywords) {
    try {
      const leads = await fetchTavilyLeads(keyword);
      allLeads.push(...leads);
    } catch {
      // Skip failed keyword searches without crashing discovery
    }
  }

  return allLeads.map(enrichLead);
}

function discoverFromFallback(): LeadInsert[] {
  return LONDON_SEED_LEADS.map(({ recommendation, ...lead }) =>
    enrichLead({ ...lead, recommendation })
  );
}

async function upsertLeads(
  supabase: SupabaseClient,
  leads: LeadInsert[]
): Promise<{ inserted: number; insertedLeadIds: string[] }> {
  let inserted = 0;
  const insertedLeadIds: string[] = [];

  for (const lead of leads) {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        ...lead,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!error && data) {
      inserted += 1;
      insertedLeadIds.push(data.id as string);
      continue;
    }

    // Unique violation — lead already exists (handles concurrent discovery runs)
    if (error?.code === '23505') continue;
  }

  return { inserted, insertedLeadIds };
}

export async function discoverLondonLeads(
  supabase: SupabaseClient | null
): Promise<DiscoverResult> {
  const keywordsSearched = getLondonKeywordStrings();
  const tavilyKey = getTavilyApiKey();
  let leads: LeadInsert[];
  let source: 'tavily' | 'fallback';

  if (tavilyKey) {
    const tavilyLeads = await discoverFromTavily();
    if (tavilyLeads.length > 0) {
      leads = tavilyLeads;
      source = 'tavily';
    } else {
      leads = discoverFromFallback();
      source = 'fallback';
    }
  } else {
    leads = discoverFromFallback();
    source = 'fallback';
  }

  let inserted = 0;
  let insertedLeadIds: string[] = [];

  if (supabase) {
    const upsertResult = await upsertLeads(supabase, leads);
    inserted = upsertResult.inserted;
    insertedLeadIds = upsertResult.insertedLeadIds;

    await supabase.from('lead_discovery_runs').insert({
      keywords_searched: keywordsSearched,
      leads_found: leads.length,
      status: 'completed',
    });
  }

  return { leads, keywordsSearched, source, inserted, insertedLeadIds };
}

export { LONDON_KEYWORDS };
