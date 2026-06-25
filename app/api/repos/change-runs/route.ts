import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import type { RepoChangeRun } from '@/lib/github/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function mapRun(row: Record<string, unknown>): RepoChangeRun {
  return {
    id: row.id as string,
    repository_id: row.repository_id as string,
    audit_id: (row.audit_id as string | null) ?? null,
    status: row.status as RepoChangeRun['status'],
    pr_url: (row.pr_url as string | null) ?? null,
    pr_number: (row.pr_number as number | null) ?? null,
    branch_name: (row.branch_name as string | null) ?? null,
    change_summary: (row.change_summary as string | null) ?? null,
    files_changed: Array.isArray(row.files_changed) ? (row.files_changed as string[]) : null,
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const auditId = searchParams.get('auditId');
  const repositoryId = searchParams.get('repositoryId');

  if (!auditId && !repositoryId) {
    return NextResponse.json(
      { error: 'auditId or repositoryId query parameter is required' },
      { status: 400 }
    );
  }

  let query = supabase
    .from('repo_change_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (auditId) {
    query = query.eq('audit_id', auditId);
  }

  if (repositoryId) {
    query = query.eq('repository_id', repositoryId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: (data ?? []).map(mapRun) });
}
