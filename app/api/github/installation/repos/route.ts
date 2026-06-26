import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { GitHubApiError } from '@/lib/github/client';
import { getInstallationForUser, listInstallationRepos } from '@/lib/github/installations';
import { hasGitHubAppConfig } from '@/lib/env';
import type { GitHubInstallationRepo, GitHubInstallationSummary } from '@/lib/github/types';

export const runtime = 'nodejs';

function mapInstallationRepo(repo: {
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch?: string;
}): GitHubInstallationRepo {
  return {
    full_name: repo.full_name,
    html_url: repo.html_url,
    private: repo.private,
    default_branch: repo.default_branch ?? 'main',
  };
}

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const githubAppConfigured = hasGitHubAppConfig();
  if (!githubAppConfigured) {
    return NextResponse.json({
      connected: false,
      githubAppConfigured: false,
      installation: null,
      repos: [] as GitHubInstallationRepo[],
      error: null,
    });
  }

  const installation = await getInstallationForUser(auth.user.id);
  if (!installation) {
    return NextResponse.json({
      connected: false,
      githubAppConfigured: true,
      installation: null,
      repos: [] as GitHubInstallationRepo[],
      error: null,
    });
  }

  const installationSummary: GitHubInstallationSummary = {
    installation_id: installation.installation_id,
    account_login: installation.account_login,
    account_type: installation.account_type,
  };

  try {
    const repos = await listInstallationRepos(installation.installation_id);
    return NextResponse.json({
      connected: true,
      githubAppConfigured: true,
      installation: installationSummary,
      repos: repos.map(mapInstallationRepo),
      error: null,
    });
  } catch (err) {
    const message =
      err instanceof GitHubApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to fetch installation repositories';

    return NextResponse.json(
      {
        connected: true,
        githubAppConfigured: true,
        installation: installationSummary,
        repos: [] as GitHubInstallationRepo[],
        error: message,
      },
      { status: 502 }
    );
  }
}
