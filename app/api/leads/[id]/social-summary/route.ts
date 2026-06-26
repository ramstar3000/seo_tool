import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSocialSummaryByLeadId } from '@/lib/research/persist';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const socialPresence = await getSocialSummaryByLeadId(supabase, id);

    if (!socialPresence) {
      return NextResponse.json({ socialPresence: null });
    }

    return NextResponse.json({ socialPresence });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load social summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
