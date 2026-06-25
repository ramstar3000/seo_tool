import type { SupabaseClient } from '@supabase/supabase-js';
import { getSerpApiKey } from '@/lib/env';
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

async function fetchSerpApiLeads(keyword: string): Promise<LeadInsert[]> {
  const apiKey = getSerpApiKey();
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

async function discoverFromSerpApi(): Promise<LeadInsert[]> {
  const keywords = getLondonKeywordStrings();
  const allLeads: LeadInsert[] = [];

  for (const keyword of keywords) {
    try {
      const leads = await fetchSerpApiLeads(keyword);
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
): Promise<number> {
  let inserted = 0;

  for (const lead of leads) {
    const { error } = await supabase.from('leads').insert({
      ...lead,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      inserted += 1;
      continue;
    }

    // Unique violation — lead already exists (handles concurrent discovery runs)
    if (error.code === '23505') continue;
  }

  return inserted;
}

export async function discoverLondonLeads(
  supabase: SupabaseClient | null
): Promise<DiscoverResult> {
  const keywordsSearched = getLondonKeywordStrings();
  const serpApiKey = getSerpApiKey();
  let leads: LeadInsert[];
  let source: 'serpapi' | 'fallback';

  if (serpApiKey) {
    const serpLeads = await discoverFromSerpApi();
    if (serpLeads.length > 0) {
      leads = serpLeads;
      source = 'serpapi';
    } else {
      leads = discoverFromFallback();
      source = 'fallback';
    }
  } else {
    leads = discoverFromFallback();
    source = 'fallback';
  }

  let inserted = 0;

  if (supabase) {
    inserted = await upsertLeads(supabase, leads);

    await supabase.from('lead_discovery_runs').insert({
      keywords_searched: keywordsSearched,
      leads_found: leads.length,
      status: 'completed',
    });
  }

  return { leads, keywordsSearched, source, inserted };
}

export { LONDON_KEYWORDS };
