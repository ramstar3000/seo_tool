import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  OUTREACH_BATCH_DEFAULT,
  OUTREACH_BATCH_DELAY_MS,
  OUTREACH_BATCH_MAX,
  sendOutreachForLead,
  sleep,
} from '@/lib/leads/send-outreach';
import type { Lead } from '@/lib/leads/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let max = OUTREACH_BATCH_DEFAULT;
  try {
    const body = (await request.json()) as { max?: unknown };
    if (typeof body.max === 'number' && Number.isFinite(body.max)) {
      max = Math.min(Math.max(1, Math.floor(body.max)), OUTREACH_BATCH_MAX);
    }
  } catch {
    // Default batch size.
  }

  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(max);

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 });
  }

  const rows = (leads ?? []) as Lead[];
  const results: Array<{
    id: string;
    business_name: string;
    success: boolean;
    testMode?: boolean;
    to?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const lead = rows[i];
    const result = await sendOutreachForLead(supabase, lead);

    if (result.success) {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        success: true,
        testMode: result.testMode,
        to: result.to,
      });
    } else {
      results.push({
        id: lead.id,
        business_name: lead.business_name,
        success: false,
        error: result.error,
      });
    }

    if (i < rows.length - 1) {
      await sleep(OUTREACH_BATCH_DELAY_MS);
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: sent > 0,
    sent,
    failed,
    attempted: rows.length,
    results,
  });
}
