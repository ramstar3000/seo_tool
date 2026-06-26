import type { SupabaseClient } from '@supabase/supabase-js';
import { applyFindingsToRepo } from '@/lib/github/apply-findings';
import { createPullRequestFromChanges } from '@/lib/github/create-pr';
import { resolveGitHubAuth, isGitHubServerConfigured } from '@/lib/github/resolve-auth';
import type { AuditFindingInput, LinkedRepository } from '@/lib/github/types';
import { flushLangfuseSpans } from '@/lib/langfuse/otel';
import { traceAutoPrRun } from '@/lib/langfuse/trace-llm';
import { notifySlack } from '@/lib/notifications/slack';
import { fetchSeoPromptContext } from '@/lib/seo/prompt-context';

const RECENT_FAILED_WINDOW_MS = 60 * 60 * 1000;

export interface AutoApplyResult {
  repositoryId: string;
  changeRunId?: string;
  status: 'completed' | 'failed' | 'skipped';
  prUrl?: string;
  prNumber?: number;
  filesChanged?: number;
  error?: string;
  reason?: string;
}

function mapLinkedRepository(row: Record<string, unknown>): LinkedRepository & { user_id: string | null } {
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
    user_id: (row.user_id as string | null) ?? null,
  };
}

async function hasRecentRun(
  supabase: SupabaseClient,
  repositoryId: string,
  auditId: string
): Promise<{ skip: boolean; reason?: string }> {
  const { data: runs } = await supabase
    .from('repo_change_runs')
    .select('id, status, created_at')
    .eq('repository_id', repositoryId)
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!runs?.length) {
    return { skip: false };
  }

  for (const run of runs) {
    const status = run.status as string;
    if (status === 'completed' || status === 'pending') {
      return { skip: true, reason: `Existing ${status} run for this audit` };
    }

    if (status === 'failed') {
      const createdAt = new Date(run.created_at as string).getTime();
      if (Date.now() - createdAt < RECENT_FAILED_WINDOW_MS) {
        return { skip: true, reason: 'Recent failed run — skipping auto-retry' };
      }
    }
  }

  return { skip: false };
}

async function executeRepoChangeRun(
  supabase: SupabaseClient,
  repo: LinkedRepository & { user_id: string | null },
  auditId: string,
  leadId: string,
  auditRow: { business_name: string; keyword: string; summary: string | null },
  findings: AuditFindingInput[]
): Promise<AutoApplyResult> {
  const recent = await hasRecentRun(supabase, repo.id, auditId);
  if (recent.skip) {
    return {
      repositoryId: repo.id,
      status: 'skipped',
      reason: recent.reason,
    };
  }

  const { data: changeRun, error: runInsertError } = await supabase
    .from('repo_change_runs')
    .insert({
      repository_id: repo.id,
      audit_id: auditId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (runInsertError || !changeRun) {
    return {
      repositoryId: repo.id,
      status: 'failed',
      error: runInsertError?.message ?? 'Failed to create change run',
    };
  }

  const changeRunId = changeRun.id as string;

  const githubAuth = repo.user_id
    ? await resolveGitHubAuth(repo.user_id, repo.installation_id ?? null)
    : await resolveGitHubAuth('', repo.installation_id ?? null);

  if (!githubAuth) {
    const error = 'GitHub credentials not available for this repository';
    await supabase
      .from('repo_change_runs')
      .update({ status: 'failed', error_message: error })
      .eq('id', changeRunId);

    return {
      repositoryId: repo.id,
      changeRunId,
      status: 'failed',
      error,
    };
  }

  try {
    const seoContext = await fetchSeoPromptContext({ leadId, auditId });

    const { changes, summary } = await applyFindingsToRepo({
      owner: repo.github_owner,
      repo: repo.github_repo,
      defaultBranch: repo.default_branch,
      contentPaths: repo.content_paths,
      businessName: auditRow.business_name,
      keyword: auditRow.keyword,
      findings,
      seoContext: seoContext ?? undefined,
      githubAuth,
    });

    const prTitle = `SynapseCRO: SEO/CRO improvements for ${auditRow.business_name}`;
    const prBody = [
      'Automated PR from SynapseCRO audit findings.',
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
      githubAuth,
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

    return {
      repositoryId: repo.id,
      changeRunId,
      status: 'completed',
      prUrl,
      prNumber,
      filesChanged: changes.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create PR';

    await supabase
      .from('repo_change_runs')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('id', changeRunId);

    return {
      repositoryId: repo.id,
      changeRunId,
      status: 'failed',
      error: message,
    };
  }
}

async function findLinkedReposForLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<Array<LinkedRepository & { user_id: string | null }>> {
  const { data, error } = await supabase
    .from('linked_repositories')
    .select('*')
    .eq('lead_id', leadId);

  if (error || !data?.length) {
    return [];
  }

  return data.map((row) => mapLinkedRepository(row as Record<string, unknown>));
}

/**
 * After an audit completes, create PRs for every repository linked to the lead.
 * Failures are logged and returned — callers should not throw on PR errors.
 */
export async function autoApplyFromAudit(params: {
  supabase: SupabaseClient;
  auditId: string;
  leadId: string;
}): Promise<AutoApplyResult[]> {
  const { supabase, auditId, leadId } = params;

  if (!isGitHubServerConfigured()) {
    return [];
  }

  const repos = await findLinkedReposForLead(supabase, leadId);
  if (repos.length === 0) {
    return [];
  }

  const { data: auditRow, error: auditError } = await supabase
    .from('site_audits')
    .select('id, status, business_name, keyword, summary')
    .eq('id', auditId)
    .single();

  if (auditError || !auditRow || auditRow.status !== 'completed') {
    console.warn('[auto-apply] Audit not ready:', auditId, auditError?.message);
    return [];
  }

  const { data: findingsRows, error: findingsError } = await supabase
    .from('audit_findings')
    .select('severity, category, title, description')
    .eq('audit_id', auditId);

  if (findingsError) {
    console.error('[auto-apply] Failed to load findings:', findingsError.message);
    return [];
  }

  const findings: AuditFindingInput[] = (findingsRows ?? []).map((f) => ({
    severity: f.severity as string,
    category: f.category as string,
    title: f.title as string,
    description: f.description as string,
  }));

  const results: AutoApplyResult[] = [];

  for (const repo of repos) {
    const result = await executeRepoChangeRun(
      supabase,
      repo,
      auditId,
      leadId,
      {
        business_name: auditRow.business_name as string,
        keyword: auditRow.keyword as string,
        summary: (auditRow.summary as string | null) ?? null,
      },
      findings
    );
    results.push(result);

    await traceAutoPrRun({
      auditId,
      leadId,
      changeRunId: result.changeRunId,
      status: result.status,
      githubOwner: repo.github_owner,
      githubRepo: repo.github_repo,
      prUrl: result.prUrl,
      prNumber: result.prNumber,
      filesChanged: result.filesChanged,
      findingCount: findings.length,
      error: result.error,
      reason: result.reason,
      source: 'auto',
    });

    if (result.status === 'completed' && result.prUrl) {
      void notifySlack(
        [
          '🤖 Auto-PR from audit',
          `Lead: ${leadId}`,
          `Repo: ${repo.github_owner}/${repo.github_repo}`,
          result.prUrl,
        ].join('\n')
      );
    } else if (result.status === 'failed') {
      console.error(
        `[auto-apply] PR failed for repo ${repo.id} audit ${auditId}:`,
        result.error
      );
      void notifySlack(
        [
          '⚠️ Auto-PR failed',
          `Lead: ${leadId}`,
          `Repo: ${repo.github_owner}/${repo.github_repo}`,
          result.error ?? 'Unknown error',
        ].join('\n')
      );
    }
  }

  await flushLangfuseSpans();

  return results;
}
