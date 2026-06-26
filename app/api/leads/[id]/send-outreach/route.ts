import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { sendOutreachForLead } from '@/lib/leads/send-outreach';
import type { Lead } from '@/lib/leads/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id } = await params;

  let body: { to?: unknown; prospectEmail?: unknown } = {};
  try {
    body = (await request.json()) as { to?: unknown; prospectEmail?: unknown };
  } catch {
    // Empty body is fine — uses OUTREACH_TARGET_EMAIL fallback.
  }

  const overrideTo = typeof body.to === 'string' ? body.to : undefined;
  const prospectEmail = typeof body.prospectEmail === 'string' ? body.prospectEmail : undefined;

  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load lead' }, { status: 500 });
  }

  const result = await sendOutreachForLead(supabase, lead as Lead, {
    overrideTo,
    prospectEmail,
  });

  if (!result.success) {
    const status = result.error.includes('OUTREACH_TARGET') || result.error.includes('prospect email')
      ? 422
      : 502;
    return NextResponse.json({ error: result.error, success: false }, { status });
  }

  return NextResponse.json({
    success: true,
    testMode: result.testMode,
    to: result.to,
    subject: result.subject,
    lead: result.lead,
  });
}
