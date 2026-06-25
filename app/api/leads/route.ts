import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const rank = searchParams.get('rank');
  const status = searchParams.get('status');
  const category = searchParams.get('category');

  let query = supabase
    .from('leads')
    .select('*')
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (rank === '3' || rank === '4') {
    query = query.eq('rank_position', Number(rank));
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const auditIds = rows
    .map((row) => row.last_audit_id as string | null)
    .filter((id): id is string => Boolean(id));

  let auditStatusById = new Map<string, string>();

  if (auditIds.length > 0) {
    const { data: audits } = await supabase
      .from('site_audits')
      .select('id, status')
      .in('id', auditIds);

    auditStatusById = new Map(
      (audits ?? []).map((a) => [a.id as string, a.status as string])
    );
  }

  const leads = rows.map((row) => ({
    ...row,
    audit_status: row.last_audit_id
      ? (auditStatusById.get(row.last_audit_id as string) ?? null)
      : null,
  }));

  return NextResponse.json({ leads });
}
