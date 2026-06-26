'use client';

import { useEffect, useState } from 'react';
import { LinkedRepositoriesPanel } from '@/components/LinkedRepositoriesPanel';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
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
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-white/[0.06] pb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Linked repositories
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            GitHub repos connected to leads. Open a research report to create fix PRs from audit findings.
          </p>
        </header>

        <SurfaceCard className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-white">How fix PRs are delivered</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Audit findings are applied by opening a <span className="text-zinc-200">pull request</span> against the
              GitHub repository that holds your website&rsquo;s source code. That means automated fixes are only
              available when your site&rsquo;s code lives in a GitHub repo you can link below.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4 space-y-2">
              <p className="text-sm font-medium text-teal-300">✓ Fix PRs work</p>
              <ul className="text-sm text-zinc-400 space-y-1 leading-relaxed">
                <li>Sites with source in GitHub (Next.js, React, static, etc.)</li>
                <li>Lovable projects with GitHub sync enabled</li>
                <li>Any platform that two-way syncs to a GitHub repo</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
              <p className="text-sm font-medium text-zinc-300">✗ No GitHub repo to PR</p>
              <ul className="text-sm text-zinc-500 space-y-1 leading-relaxed">
                <li>Wix, Squarespace, Webflow, Shopify</li>
                <li>Framer, Carrd, and most no-code builders</li>
                <li>Hosted CMSes with no source access</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            On unsupported platforms the audit still runs and you still receive the full findings report — only the
            automated pull request is unavailable, since there is no repository to open one against. Apply those fixes
            in your builder&rsquo;s editor.
          </p>
        </SurfaceCard>

        {githubConfigured === false && (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            Set <code className="text-amber-200">GITHUB_TOKEN</code> in <code className="text-amber-200">.env.local</code>{' '}
            (PAT with repo scope) to create pull requests.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : repos.length === 0 ? (
          <SurfaceCard className="p-6 text-center text-zinc-500 text-sm">
            No linked repositories yet. Link one from a research report.
          </SurfaceCard>
        ) : (
          <section className="space-y-4">
            <p className="text-sm text-zinc-400">
              {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'} across {leadIds.length} lead
              {leadIds.length === 1 ? '' : 's'}
            </p>
            <SurfaceCard className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02] text-left text-zinc-400 border-b border-white/[0.06]">
                    <th className="px-4 py-3 font-medium">Repository</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((repo) => (
                    <tr key={repo.id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-3">
                        <a
                          href={repo.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:underline"
                        >
                          {repo.github_owner}/{repo.github_repo}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{repo.label ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-400">{repo.default_branch}</td>
                      <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                        {repo.lead_id?.slice(0, 8) ?? '—'}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SurfaceCard>
          </section>
        )}

        {leadIds.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Manage by lead</h2>
            {leadIds.map((leadId) => (
              <div key={leadId} className="space-y-2">
                <p className="text-xs text-zinc-500 font-mono">Lead {leadId}</p>
                <LinkedRepositoriesPanel leadId={leadId} compact />
              </div>
            ))}
          </section>
        )}
      </PageContainer>
    </main>
  );
}
