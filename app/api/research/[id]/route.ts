import { NextRequest, NextResponse } from 'next/server';
import { canAccessAudit } from '@/lib/auth/audit-access';
import { getAuditById } from '@/lib/research/persist';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id } = await context.params;

  const sessionClient = await createServerSupabaseClient();
  let user = null;
  if (sessionClient) {
    const {
      data: { user: sessionUser },
    } = await sessionClient.auth.getUser();
    user = sessionUser;
  }

  const allowed = await canAccessAudit(supabase, id, user);
  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const audit = await getAuditById(supabase, id);

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    return NextResponse.json({ audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audit';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
