import { NextRequest, NextResponse } from 'next/server';
import { apiError, apiNotConfigured } from '@/lib/api/errors';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return apiNotConfigured('Supabase');
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
    return apiError(error.message, 500, 'DB_ERROR');
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

  let autoPrByAuditId = new Map<
    string,
    { pr_url: string; pr_number: number | null; audit_id: string }
  >();

  if (auditIds.length > 0) {
    const { data: prRuns } = await supabase
      .from('repo_change_runs')
      .select('audit_id, pr_url, pr_number, created_at')
      .in('audit_id', auditIds)
      .eq('status', 'completed')
      .not('pr_url', 'is', null)
      .order('created_at', { ascending: false });

    for (const run of prRuns ?? []) {
      const auditId = run.audit_id as string;
      if (!autoPrByAuditId.has(auditId) && run.pr_url) {
        autoPrByAuditId.set(auditId, {
          pr_url: run.pr_url as string,
          pr_number: (run.pr_number as number | null) ?? null,
          audit_id: auditId,
        });
      }
    }
  }

  const leads = rows.map((row) => ({
    ...row,
    audit_status: row.last_audit_id
      ? (auditStatusById.get(row.last_audit_id as string) ?? null)
      : null,
    auto_pr: row.last_audit_id
      ? (autoPrByAuditId.get(row.last_audit_id as string) ?? null)
      : null,
  }));

  return NextResponse.json({ leads });
}
