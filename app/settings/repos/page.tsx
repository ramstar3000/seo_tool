'use client';

import { useEffect, useState } from 'react';
import { LinkedRepositoriesPanel } from '@/components/LinkedRepositoriesPanel';
import type { LinkedRepository } from '@/lib/github/types';

export default function SettingsReposPage() {
  const [repos, setRepos] = useState<LinkedRepository[]>([]);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/repos?all=true');
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Failed to load repositories');
        }
        const body = (await response.json()) as {
          repos: LinkedRepository[];
          githubConfigured: boolean;
        };
        setRepos(body.repos);
        setGithubConfigured(body.githubConfigured);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repositories');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const leadIds = [...new Set(repos.map((r) => r.lead_id).filter(Boolean))] as string[];

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Linked repositories
          </h1>
          <p className="text-slate-400">
            All GitHub repositories linked across leads. Use the research audit page to create PRs from
            findings.
          </p>
        </header>

        {githubConfigured === false && (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
            Set <code className="text-amber-200">GITHUB_TOKEN</code> in <code className="text-amber-200">.env.local</code>{' '}
            (PAT with repo scope) to enable pull request creation.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : repos.length === 0 ? (
          <p className="text-slate-500">
            No linked repositories yet. Link repos from a research audit or lead detail view.
          </p>
        ) : (
          <section className="space-y-6">
            <p className="text-sm text-slate-400">
              {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'} across {leadIds.length} lead
              {leadIds.length === 1 ? '' : 's'}
            </p>
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-left text-slate-400 border-b border-slate-800">
                    <th className="px-4 py-3 font-medium">Repository</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((repo) => (
                    <tr key={repo.id} className="border-b border-slate-800/80">
                      <td className="px-4 py-3">
                        <a
                          href={repo.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline"
                        >
                          {repo.github_owner}/{repo.github_repo}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{repo.label ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{repo.default_branch}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {repo.lead_id?.slice(0, 8) ?? '—'}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {leadIds.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Manage by lead</h2>
            {leadIds.map((leadId) => (
              <div key={leadId} className="space-y-2">
                <p className="text-xs text-slate-500 font-mono">Lead {leadId}</p>
                <LinkedRepositoriesPanel leadId={leadId} compact />
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
