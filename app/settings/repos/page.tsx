'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import type {
  GitHubInstallationRepo,
  GitHubInstallationSummary,
  LinkedRepository,
} from '@/lib/github/types';

function formatLinkedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function githubInstallationSettingsUrl(installation: GitHubInstallationSummary): string {
  if (installation.account_type === 'Organization') {
    return `https://github.com/organizations/${installation.account_login}/settings/installations/${installation.installation_id}`;
  }
  return `https://github.com/settings/installations/${installation.installation_id}`;
}

export default function SettingsReposPage() {
  const [installationRepos, setInstallationRepos] = useState<GitHubInstallationRepo[]>([]);
  const [linkedRepos, setLinkedRepos] = useState<LinkedRepository[]>([]);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [githubAppConfigured, setGithubAppConfigured] = useState<boolean>(false);
  const [githubInstallation, setGithubInstallation] = useState<GitHubInstallationSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [installationReposError, setInstallationReposError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<{
    connected: boolean;
    error: string | null;
    pending: boolean;
  }>({ connected: false, error: null, pending: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConnectStatus({
      connected: params.get('connected') === '1',
      error: params.get('error'),
      pending: params.get('pending') === '1',
    });
  }, []);

  const loadData = useCallback(async () => {
    setLinkedError(null);
    try {
      const [linkedResponse, installationReposResponse] = await Promise.all([
        fetch('/api/repos?all=true'),
        fetch('/api/github/installation/repos'),
      ]);

      if (!linkedResponse.ok) {
        const body = (await linkedResponse.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load linked repositories');
      }

      const linkedBody = (await linkedResponse.json()) as {
        repos?: LinkedRepository[];
        githubConfigured: boolean;
        githubAppConfigured?: boolean;
        githubInstallation?: GitHubInstallationSummary | null;
      };

      setLinkedRepos(linkedBody.repos ?? []);
      setGithubConfigured(linkedBody.githubConfigured);
      setGithubAppConfigured(Boolean(linkedBody.githubAppConfigured));
      setGithubInstallation(linkedBody.githubInstallation ?? null);

      if (installationReposResponse.ok) {
        const installationBody = (await installationReposResponse.json()) as {
          repos?: GitHubInstallationRepo[];
          installation?: GitHubInstallationSummary | null;
          error?: string | null;
        };
        setInstallationRepos(installationBody.repos ?? []);
        setInstallationReposError(installationBody.error ?? null);
        if (installationBody.installation) {
          setGithubInstallation(installationBody.installation);
        }
      } else {
        const body = (await installationReposResponse.json()) as { error?: string };
        setInstallationRepos([]);
        setInstallationReposError(body.error ?? 'Failed to load GitHub App repositories');
      }
    } catch (err) {
      setLinkedError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUnlink = async (id: string) => {
    setActionError(null);
    setUnlinkingId(id);
    try {
      const response = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to unlink repository');
      }
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to unlink repository');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        'Disconnect the GitHub App from SynapseCRO? You can reconnect and choose different repositories anytime.'
      )
    ) {
      return;
    }

    setActionError(null);
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/github/installation', { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to disconnect GitHub App');
      }
      setGithubInstallation(null);
      setInstallationRepos([]);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to disconnect GitHub App');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-white/[0.06] pb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Linked repositories
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            GitHub repos connected to your account. Link a repo to a lead from a research report to
            open fix PRs from audit findings.
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
            On no-code platforms (Wix, Squarespace, Webflow, etc.) the audit still runs and you receive a{' '}
            <span className="text-zinc-400">fix pack</span> — copy-paste values, platform playbooks, schema
            snippets, and a printable checklist. Automated pull requests are only available when your site&apos;s
            source lives in a linked GitHub repo.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">GitHub connection</h2>
              <p className="text-sm text-zinc-400">
                Install the SynapseCRO GitHub App to open fix PRs with your own quota. A shared{' '}
                <code className="text-zinc-300">GITHUB_TOKEN</code> still works as a fallback for local dev.
              </p>
            </div>
            {githubAppConfigured && !githubInstallation && (
              <a
                href="/api/github/install"
                className="inline-flex min-h-10 items-center px-4 rounded-xl bg-teal-500/15 border border-teal-500/30 text-sm font-medium text-teal-300 hover:bg-teal-500/25"
              >
                Connect GitHub App
              </a>
            )}
          </div>

          {connectStatus.connected && githubInstallation && (
            <p className="text-sm text-teal-300 bg-teal-500/10 border border-teal-500/30 rounded-xl px-4 py-3">
              Connected to GitHub as{' '}
              <span className="font-medium">{githubInstallation.account_login}</span> (
              {githubInstallation.account_type}).
            </p>
          )}

          {connectStatus.pending && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              GitHub install is pending approval. Complete the flow on GitHub, then return here.
            </p>
          )}

          {connectStatus.error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              GitHub connection failed: {connectStatus.error}
            </p>
          )}

          {!githubAppConfigured && githubConfigured === false && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              Set <code className="text-amber-200">GITHUB_APP_*</code> env vars (see{' '}
              <code className="text-amber-200">docs/GITHUB_APP_SETUP.md</code>) or add a{' '}
              <code className="text-amber-200">GITHUB_TOKEN</code> PAT to enable PR creation.
            </p>
          )}

          {githubInstallation && !connectStatus.connected && (
            <p className="text-sm text-zinc-400">
              Connected as{' '}
              <span className="text-zinc-200">{githubInstallation.account_login}</span> (
              {githubInstallation.account_type}).
            </p>
          )}

          {githubConfigured === false && githubAppConfigured && !githubInstallation && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              Connect the GitHub App above to create pull requests from audit findings.
            </p>
          )}

          {githubInstallation && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-2">
                <a
                  href={githubInstallationSettingsUrl(githubInstallation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  Manage repository access
                </a>
                <a
                  href="/api/github/install"
                  className="inline-flex min-h-9 items-center px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  Reconnect
                </a>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={isDisconnecting}
                  className="inline-flex min-h-9 items-center px-3 rounded-xl text-sm font-medium text-red-300 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {isDisconnecting ? 'Disconnecting…' : 'Disconnect GitHub App'}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Use <span className="text-zinc-400">Manage repository access</span> on GitHub to add
                or remove repos, then refresh this page. Use{' '}
                <span className="text-zinc-400">Reconnect</span> or{' '}
                <span className="text-zinc-400">Disconnect</span> to change which account is
                connected.
              </p>
            </div>
          )}
        </SurfaceCard>

        {actionError && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            {actionError}
          </p>
        )}

        {linkedError && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            {linkedError}
          </p>
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Available via GitHub App</h2>
            <p className="text-sm text-zinc-400">
              Repositories you granted access to when installing the SynapseCRO GitHub App on GitHub.
            </p>
          </div>

          {installationReposError && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              Could not load GitHub App repositories: {installationReposError}
            </p>
          )}

          {isLoading ? (
            <p className="text-zinc-500">Loading…</p>
          ) : !githubInstallation ? (
            <SurfaceCard className="p-6 text-center space-y-2">
              <p className="text-zinc-400 text-sm">
                Connect the GitHub App above to see which repositories the app can access.
              </p>
            </SurfaceCard>
          ) : installationRepos.length === 0 && !installationReposError ? (
            <SurfaceCard className="p-6 text-center space-y-2">
              <p className="text-zinc-400 text-sm">
                No repositories are granted to your GitHub App installation yet. On GitHub, open your
                app settings and grant access to the repos you want, then refresh this page.
              </p>
            </SurfaceCard>
          ) : installationRepos.length > 0 ? (
            <SurfaceCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] text-left text-zinc-400 border-b border-white/[0.06]">
                      <th className="px-4 py-3 font-medium">Repository</th>
                      <th className="px-4 py-3 font-medium">Visibility</th>
                      <th className="px-4 py-3 font-medium">Default branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installationRepos.map((repo) => (
                      <tr
                        key={repo.full_name}
                        className="border-b border-white/[0.04] last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:underline font-medium"
                          >
                            {repo.full_name}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {repo.private ? 'Private' : 'Public'}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{repo.default_branch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Linked to leads</h2>
            <p className="text-sm text-zinc-400">
              Repositories explicitly linked from research reports for audit fix PRs.
              {linkedRepos.length > 0 && (
                <>
                  {' '}
                  · {linkedRepos.length} linked repo{linkedRepos.length === 1 ? '' : 's'}
                </>
              )}
            </p>
          </div>

          {isLoading ? (
            <p className="text-zinc-500">Loading…</p>
          ) : linkedRepos.length === 0 ? (
            <SurfaceCard className="p-6 text-center space-y-2">
              <p className="text-zinc-400 text-sm">No repositories linked to leads yet.</p>
              <p className="text-zinc-500 text-sm">
                Link a repo from a research report to enable fix PRs for that site.
              </p>
            </SurfaceCard>
          ) : (
            <SurfaceCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] text-left text-zinc-400 border-b border-white/[0.06]">
                      <th className="px-4 py-3 font-medium">Repository</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Linked</th>
                      <th className="px-4 py-3 font-medium w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedRepos.map((repo) => (
                      <tr
                        key={repo.id}
                        className="border-b border-white/[0.04] last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={repo.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:underline font-medium"
                          >
                            {repo.github_owner}/{repo.github_repo}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{repo.default_branch}</td>
                        <td className="px-4 py-3 text-zinc-400">
                          <span title={repo.lead_id ?? undefined}>
                            {formatLinkedDate(repo.created_at)}
                            {repo.label && (
                              <span className="block text-xs text-zinc-500 mt-0.5">
                                {repo.label}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleUnlink(repo.id)}
                            disabled={unlinkingId === repo.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-300 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-60"
                          >
                            {unlinkingId === repo.id ? 'Unlinking…' : 'Unlink'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          )}
        </section>
      </PageContainer>
    </main>
  );
}
