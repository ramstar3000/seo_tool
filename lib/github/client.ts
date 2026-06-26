import { getGitHubToken } from '@/lib/env';
import { getInstallationToken, hasGitHubAppConfig } from '@/lib/github/app-auth';
import { recordApiUsage } from '@/lib/cost/tracker';

const GITHUB_API = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export type GitHubFetchOptions = RequestInit & {
  /** Explicit bearer token (installation token or PAT). */
  token?: string;
  /** Resolve token via GitHub App installation (overridden by `token`). */
  installationId?: number;
};

export function isGitHubConfigured(): boolean {
  return Boolean(getGitHubToken()) || hasGitHubAppConfig();
}

async function resolveFetchToken(options: GitHubFetchOptions): Promise<string> {
  if (options.token) {
    return options.token;
  }

  if (options.installationId) {
    return getInstallationToken(options.installationId);
  }

  const pat = getGitHubToken();
  if (pat) {
    return pat;
  }

  throw new Error('GitHub is not configured (no PAT or installation token)');
}

export async function githubFetch<T = unknown>(
  path: string,
  options: GitHubFetchOptions = {}
): Promise<T> {
  const { token: _token, installationId: _installationId, ...fetchOptions } = options;
  const token = await resolveFetchToken(options);

  const url = path.startsWith('http') ? path : `${GITHUB_API}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubApiError(
      `GitHub API error (${response.status}): ${body.slice(0, 300)}`,
      response.status,
      body
    );
  }

  if (response.status === 204) {
    await recordApiUsage({
      provider: 'github',
      operation: 'api_call',
      units: 1,
      metadata: { path: path.slice(0, 120), status: 204 },
    });
    return undefined as T;
  }

  const json = await response.json();

  await recordApiUsage({
    provider: 'github',
    operation: 'api_call',
    units: 1,
    metadata: { path: path.slice(0, 120), status: response.status },
  });

  return json as T;
}
