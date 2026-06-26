import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getInstallationForUser } from '@/lib/github/installations';
import { isGitHubAuthAvailable } from '@/lib/github/resolve-auth';
import { hasGitHubAppConfig } from '@/lib/env';
import type { GitHubInstallationSummary, LinkedRepository } from '@/lib/github/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function mapRepo(row: Record<string, unknown>): LinkedRepository {
  return {
    id: row.id as string,
    lead_id: (row.lead_id as string | null) ?? null,
    audit_id: (row.audit_id as string | null) ?? null,
    label: (row.label as string | null) ?? null,
    github_owner: row.github_owner as string,
    github_repo: row.github_repo as string,
    default_branch: (row.default_branch as string) ?? 'main',
    repo_url: row.repo_url as string,
    content_paths: Array.isArray(row.content_paths) ? (row.content_paths as string[]) : [],
    installation_id: (row.installation_id as number | null) ?? null,
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
  const leadId = searchParams.get('leadId');
  const all = searchParams.get('all') === 'true';

  let query = supabase
    .from('linked_repositories')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (leadId) {
    query = query.eq('lead_id', leadId);
  } else if (!all) {
    return NextResponse.json({ error: 'leadId query parameter is required' }, { status: 400 });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const installation = await getInstallationForUser(auth.user.id);
  const githubInstallation: GitHubInstallationSummary | null = installation
    ? {
        installation_id: installation.installation_id,
        account_login: installation.account_login,
        account_type: installation.account_type,
      }
    : null;

  return NextResponse.json({
    repos: (data ?? []).map(mapRepo),
    githubConfigured: await isGitHubAuthAvailable(auth.user.id),
    githubAppConfigured: hasGitHubAppConfig(),
    githubInstallation,
    /** @deprecated use githubConfigured — kept for older clients */
    patConfigured: Boolean(process.env.GITHUB_TOKEN),
  });
}
