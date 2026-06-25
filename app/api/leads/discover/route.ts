import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { discoverLondonLeads } from '@/lib/leads/discover';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const result = await discoverLondonLeads(supabase);

    return NextResponse.json({
      success: true,
      source: result.source,
      inserted: result.inserted,
      leadsFound: result.leads.length,
      keywordsSearched: result.keywordsSearched,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Discovery failed' }, { status: 500 });
  }
}
