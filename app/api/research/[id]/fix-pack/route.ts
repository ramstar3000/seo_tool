import { NextRequest, NextResponse } from 'next/server';
import { canAccessAudit } from '@/lib/auth/audit-access';
import { generateFixPackForAuditId } from '@/lib/fix-pack/generate';
import { getFixPackByAuditId, saveFixPack } from '@/lib/fix-pack/persist';
import { getAuditById } from '@/lib/research/persist';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function resolveAccess(auditId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: NextResponse.json({ error: 'Supabase not configured' }, { status: 503 }) };
  }

  const sessionClient = await createServerSupabaseClient();
  let user = null;
  if (sessionClient) {
    const {
      data: { user: sessionUser },
    } = await sessionClient.auth.getUser();
    user = sessionUser;
  }

  const allowed = await canAccessAudit(supabase, auditId, user);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { supabase, auditId };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await context.params;
  const access = await resolveAccess(auditId);
  if ('error' in access && access.error) return access.error;

  const { supabase } = access;

  try {
    const record = await getFixPackByAuditId(supabase!, auditId);
    if (!record) {
      return NextResponse.json({ fixPack: null, status: 'missing' });
    }
    return NextResponse.json({
      fixPack: record.pack_json,
      status: record.status,
      error: record.error_message,
      platformLabel: record.platform_label,
      createdAt: record.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load fix pack';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await context.params;
  const access = await resolveAccess(auditId);
  if ('error' in access && access.error) return access.error;

  const { supabase } = access;

  try {
    const audit = await getAuditById(supabase!, auditId);
    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    if (audit.status !== 'completed') {
      return NextResponse.json({ error: 'Audit is not completed yet' }, { status: 400 });
    }

    const pack = await generateFixPackForAuditId(supabase!, auditId);
    const record = await saveFixPack(supabase!, auditId, pack);

    return NextResponse.json({
      fixPack: record.pack_json,
      status: record.status,
      platformLabel: record.platform_label,
      createdAt: record.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fix pack generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
