import { getGitHubToken } from '@/lib/env';

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

export function isGitHubConfigured(): boolean {
  return Boolean(getGitHubToken());
}

export async function githubFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  const url = path.startsWith('http') ? path : `${GITHUB_API}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
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
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
