import { NextResponse } from 'next/server';
import { listRecentAudits } from '@/lib/research/persist';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const audits = await listRecentAudits(supabase);
    return NextResponse.json({ audits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list audits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
