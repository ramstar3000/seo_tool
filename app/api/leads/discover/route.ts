import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { queueAutoResearchForLeads } from '@/lib/leads/auto-research';
import { discoverLondonLeads } from '@/lib/leads/discover';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const result = await discoverLondonLeads(supabase);

    let autoResearch = { queued: 0, skipped: 0, synced: 0, background: 0 };
    if (result.insertedLeadIds.length > 0) {
      autoResearch = await queueAutoResearchForLeads(supabase, result.insertedLeadIds);
    }

    return NextResponse.json({
      success: true,
      source: result.source,
      inserted: result.inserted,
      leadsFound: result.leads.length,
      keywordsSearched: result.keywordsSearched,
      autoResearch,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Discovery failed' }, { status: 500 });
  }
}
