'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LinkedRepository, RepoChangeRun } from '@/lib/github/types';

interface LinkedRepositoriesPanelProps {
  leadId: string;
  auditId?: string;
  auditStatus?: string;
  compact?: boolean;
}

export function LinkedRepositoriesPanel({
  leadId,
  auditId,
  auditStatus,
  compact = false,
}: LinkedRepositoriesPanelProps) {
  const [repos, setRepos] = useState<LinkedRepository[]>([]);
  const [runs, setRuns] = useState<RepoChangeRun[]>([]);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [label, setLabel] = useState('');
  const [contentPaths, setContentPaths] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const reposRes = await fetch(`/api/repos?leadId=${encodeURIComponent(leadId)}`);
      if (!reposRes.ok) {
        const body = (await reposRes.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load repositories');
      }
      const reposBody = (await reposRes.json()) as {
        repos: LinkedRepository[];
        githubConfigured: boolean;
      };
      setRepos(reposBody.repos);
      setGithubConfigured(reposBody.githubConfigured);

      if (auditId) {
        const runsRes = await fetch(`/api/repos/change-runs?auditId=${encodeURIComponent(auditId)}`);
        if (runsRes.ok) {
          const runsBody = (await runsRes.json()) as { runs: RepoChangeRun[] };
          setRuns(runsBody.runs);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [leadId, auditId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const reposRes = await fetch(`/api/repos?leadId=${encodeURIComponent(leadId)}`);
        if (!reposRes.ok) {
          const body = (await reposRes.json()) as { error?: string };
          throw new Error(body.error ?? 'Failed to load repositories');
        }
        const reposBody = (await reposRes.json()) as {
          repos: LinkedRepository[];
          githubConfigured: boolean;
        };
        if (cancelled) return;
        setRepos(reposBody.repos);
        setGithubConfigured(reposBody.githubConfigured);

        if (auditId) {
          const runsRes = await fetch(`/api/repos/change-runs?auditId=${encodeURIComponent(auditId)}`);
          if (runsRes.ok) {
            const runsBody = (await runsRes.json()) as { runs: RepoChangeRun[] };
            if (!cancelled) setRuns(runsBody.runs);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load repositories');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, auditId]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setIsLinking(true);
    setError(null);

    try {
      const paths = contentPaths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const response = await fetch('/api/repos/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          repoUrl: repoUrl.trim(),
          label: label.trim() || undefined,
          contentPaths: paths.length > 0 ? paths : undefined,
          auditId,
        }),
      });

      const body = (await response.json()) as { error?: string; repo?: LinkedRepository };

      if (!response.ok || !body.repo) {
        throw new Error(body.error ?? 'Failed to link repository');
      }

      setRepoUrl('');
      setLabel('');
      setContentPaths('');
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link repository');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to unlink repository');
      }
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink repository');
    }
  };

  const handleApply = async (repositoryId: string) => {
    if (!auditId) return;

    setApplyingId(repositoryId);
    setError(null);

    try {
      const response = await fetch(`/api/repos/${repositoryId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });

      const body = (await response.json()) as { error?: string; prUrl?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to create PR');
      }

      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PR');
    } finally {
      setApplyingId(null);
    }
  };

  const canCreatePr = Boolean(auditId && auditStatus === 'completed' && githubConfigured);

  return (
    <div className={`space-y-4 ${compact ? '' : 'p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]'}`}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-white">Linked repositories</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Connect a GitHub repo to open pull requests with SEO fixes from audit findings.
          </p>
        </div>
      )}

      {githubConfigured === false && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <span className="font-medium">GITHUB_TOKEN not configured.</span> Add a Personal Access Token with{' '}
          <code className="text-amber-200">repo</code> scope to <code className="text-amber-200">.env.local</code>{' '}
          to create pull requests. Linking repos still works for demo.
        </p>
      )}

      {auditId && auditStatus !== 'completed' && (
        <p className="text-sm text-zinc-500">
          Complete the audit before creating a PR from findings.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void handleLink(e)} className="space-y-3">
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">GitHub repo URL</span>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full min-h-10 px-3 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm text-zinc-100 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">Label (optional)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Marketing site"
              className="w-full min-h-10 px-3 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm text-zinc-100 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">
            Content path hints (optional, comma-separated)
          </span>
          <input
            type="text"
            value={contentPaths}
            onChange={(e) => setContentPaths(e.target.value)}
            placeholder="app/page.tsx, src/content/hero.json"
            className="w-full min-h-10 px-3 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm text-zinc-100 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <button
          type="submit"
          disabled={isLinking}
          className="inline-flex min-h-10 items-center px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-zinc-100 hover:bg-white/[0.06] disabled:opacity-60"
        >
          {isLinking ? 'Linking…' : 'Link repository'}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading linked repositories…</p>
      ) : repos.length === 0 ? (
        <p className="text-sm text-zinc-500">No repositories linked yet.</p>
      ) : (
        <ul className="space-y-3">
          {repos.map((repo) => {
            const repoRuns = runs.filter((r) => r.repository_id === repo.id);
            const latestRun = repoRuns[0];

            return (
              <li
                key={repo.id}
                className="p-4 rounded-xl border border-white/[0.06] bg-zinc-950/40 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">
                      {repo.label ?? `${repo.github_owner}/${repo.github_repo}`}
                    </p>
                    <a
                      href={repo.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:underline"
                    >
                      {repo.repo_url}
                    </a>
                    <p className="text-xs text-zinc-500 mt-1">
                      Branch: {repo.default_branch}
                      {repo.content_paths.length > 0 && (
                        <> · Paths: {repo.content_paths.join(', ')}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canCreatePr && (
                      <button
                        type="button"
                        onClick={() => void handleApply(repo.id)}
                        disabled={applyingId === repo.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 disabled:opacity-60"
                      >
                        {applyingId === repo.id ? 'Creating PR…' : 'Create PR from findings'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleUnlink(repo.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-300 border border-red-500/30 hover:bg-red-500/10"
                    >
                      Unlink
                    </button>
                  </div>
                </div>

                {latestRun && (
                  <div className="text-xs space-y-1 pt-1 border-t border-white/[0.06]">
                    {latestRun.status === 'completed' && latestRun.pr_url && (
                      <p className="text-teal-300">
                        PR #{latestRun.pr_number}:{' '}
                        <a
                          href={latestRun.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-teal-200"
                        >
                          {latestRun.pr_url}
                        </a>
                      </p>
                    )}
                    {latestRun.status === 'failed' && (
                      <p className="text-red-300">Failed: {latestRun.error_message ?? 'Unknown error'}</p>
                    )}
                    {latestRun.status === 'pending' && (
                      <p className="text-zinc-500">PR creation in progress…</p>
                    )}
                    {latestRun.files_changed && latestRun.files_changed.length > 0 && (
                      <p className="text-zinc-500">
                        Files: {latestRun.files_changed.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
