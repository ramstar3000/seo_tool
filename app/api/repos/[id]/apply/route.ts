import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { applyFindingsToRepo } from '@/lib/github/apply-findings';
import { isGitHubConfigured } from '@/lib/github/client';
import { createPullRequestFromChanges } from '@/lib/github/create-pr';
import type { AuditFindingInput, LinkedRepository } from '@/lib/github/types';
import { fetchSeoPromptContext } from '@/lib/seo/prompt-context';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// TODO(scale): horizontal-scaling debt for this PR-ing endpoint.
//   1. Shared GitHub PAT (getGitHubToken) — a single token's 5,000 req/hr REST
//      quota is shared across ALL users/tenants. Move to per-user GitHub App
//      installation tokens so quota scales per customer and we don't need their
//      raw PAT. This is the multi-tenant blocker.
//   2. Synchronous long request — applyFindingsToRepo runs an LLM call + many
//      sequential GitHub API calls inside the HTTP request. Under load this hits
//      serverless/Fly timeouts. Offload to a durable queue + worker and have the
//      client poll repo_change_runs.status (the row already models async state).
//   3. No idempotency/locking — two concurrent applies for the same
//      (repository_id, audit_id) create duplicate branches/PRs. Add a unique
//      constraint or advisory lock keyed on that pair before going multi-machine.
//   4. Per-process state — cost tracker and any rate limiting must use a shared
//      store (Supabase/Redis), not in-memory, before scaling past one Fly machine.

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN is not configured. Add a Personal Access Token with repo scope to .env.local.' },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id: repositoryId } = await context.params;

  let body: { auditId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { auditId } = body;
  if (!auditId) {
    return NextResponse.json({ error: 'auditId is required' }, { status: 400 });
  }

  const { data: repoRow, error: repoError } = await supabase
    .from('linked_repositories')
    .select('*')
    .eq('id', repositoryId)
    .single();

  if (repoError || !repoRow) {
    return NextResponse.json({ error: 'Linked repository not found' }, { status: 404 });
  }

  if (repoRow.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const repo: LinkedRepository = {
    id: repoRow.id as string,
    lead_id: (repoRow.lead_id as string | null) ?? null,
    audit_id: (repoRow.audit_id as string | null) ?? null,
    label: (repoRow.label as string | null) ?? null,
    github_owner: repoRow.github_owner as string,
    github_repo: repoRow.github_repo as string,
    default_branch: (repoRow.default_branch as string) ?? 'main',
    repo_url: repoRow.repo_url as string,
    content_paths: Array.isArray(repoRow.content_paths) ? (repoRow.content_paths as string[]) : [],
    created_at: repoRow.created_at as string,
  };

  const { data: auditRow, error: auditError } = await supabase
    .from('site_audits')
    .select('id, status, business_name, keyword, summary')
    .eq('id', auditId)
    .single();

  if (auditError || !auditRow) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  if (auditRow.status !== 'completed') {
    return NextResponse.json({ error: 'Audit must be completed before creating a PR' }, { status: 400 });
  }

  const { data: findingsRows, error: findingsError } = await supabase
    .from('audit_findings')
    .select('severity, category, title, description')
    .eq('audit_id', auditId);

  if (findingsError) {
    return NextResponse.json({ error: findingsError.message }, { status: 500 });
  }

  const findings: AuditFindingInput[] = (findingsRows ?? []).map((f) => ({
    severity: f.severity as string,
    category: f.category as string,
    title: f.title as string,
    description: f.description as string,
  }));

  const { data: changeRun, error: runInsertError } = await supabase
    .from('repo_change_runs')
    .insert({
      repository_id: repositoryId,
      audit_id: auditId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (runInsertError || !changeRun) {
    return NextResponse.json({ error: runInsertError?.message ?? 'Failed to create change run' }, { status: 500 });
  }

  const changeRunId = changeRun.id as string;

  try {
    const seoContext = repo.lead_id
      ? await fetchSeoPromptContext({ leadId: repo.lead_id, auditId })
      : await fetchSeoPromptContext({ auditId });

    const { changes, summary } = await applyFindingsToRepo({
      owner: repo.github_owner,
      repo: repo.github_repo,
      defaultBranch: repo.default_branch,
      contentPaths: repo.content_paths,
      businessName: auditRow.business_name as string,
      keyword: auditRow.keyword as string,
      findings,
      seoContext: seoContext ?? undefined,
    });

    const prTitle = `SynapseCRO: SEO/CRO improvements for ${auditRow.business_name}`;
    const prBody = [
      `Automated PR from SynapseCRO audit findings.`,
      '',
      auditRow.summary ? `**Summary:** ${auditRow.summary}` : '',
      '',
      '**Changes:**',
      ...changes.map((c) => `- \`${c.path}\`: ${c.message}`),
      '',
      `Audit ID: \`${auditId}\``,
    ]
      .filter(Boolean)
      .join('\n');

    const { prUrl, prNumber, branchName } = await createPullRequestFromChanges({
      owner: repo.github_owner,
      repo: repo.github_repo,
      defaultBranch: repo.default_branch,
      changes,
      prTitle,
      prBody,
    });

    await supabase
      .from('repo_change_runs')
      .update({
        status: 'completed',
        pr_url: prUrl,
        pr_number: prNumber,
        branch_name: branchName,
        change_summary: summary,
        files_changed: changes.map((c) => c.path),
      })
      .eq('id', changeRunId);

    return NextResponse.json({ prUrl, changeRunId, prNumber, branchName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create PR';

    await supabase
      .from('repo_change_runs')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('id', changeRunId);

    return NextResponse.json({ error: message, changeRunId }, { status: 500 });
  }
}
