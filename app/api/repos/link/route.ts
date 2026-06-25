import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { githubFetch, isGitHubConfigured } from '@/lib/github/client';
import { parseRepoUrl } from '@/lib/github/parse-repo-url';
import type { LinkedRepository } from '@/lib/github/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let body: {
    leadId?: string;
    repoUrl?: string;
    label?: string;
    contentPaths?: string[];
    auditId?: string;
    defaultBranch?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leadId, repoUrl, label, contentPaths, auditId, defaultBranch } = body;

  if (!leadId || !repoUrl) {
    return NextResponse.json({ error: 'leadId and repoUrl are required' }, { status: 400 });
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 });
  }

  let resolvedBranch = defaultBranch ?? 'main';

  if (isGitHubConfigured()) {
    try {
      const repoMeta = await githubFetch<{ default_branch: string }>(
        `/repos/${parsed.owner}/${parsed.repo}`
      );
      resolvedBranch = defaultBranch ?? repoMeta.default_branch ?? 'main';
    } catch {
      // Keep fallback branch when token missing or repo inaccessible
    }
  }

  const { data, error } = await supabase
    .from('linked_repositories')
    .insert({
      lead_id: leadId,
      audit_id: auditId ?? null,
      label: label ?? null,
      github_owner: parsed.owner,
      github_repo: parsed.repo,
      default_branch: resolvedBranch,
      repo_url: parsed.repoUrl,
      content_paths: contentPaths ?? [],
      user_id: auth.user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to link repository' }, { status: 500 });
  }

  const repo: LinkedRepository = {
    id: data.id as string,
    lead_id: (data.lead_id as string | null) ?? null,
    audit_id: (data.audit_id as string | null) ?? null,
    label: (data.label as string | null) ?? null,
    github_owner: data.github_owner as string,
    github_repo: data.github_repo as string,
    default_branch: (data.default_branch as string) ?? 'main',
    repo_url: data.repo_url as string,
    content_paths: Array.isArray(data.content_paths) ? (data.content_paths as string[]) : [],
    created_at: data.created_at as string,
  };

  return NextResponse.json({ repo, githubConfigured: isGitHubConfigured() });
}
