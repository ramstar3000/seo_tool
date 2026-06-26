import { githubFetch, type GitHubFetchOptions } from '@/lib/github/client';
import { notifySlack } from '@/lib/notifications/slack';
import type { GitHubAuthContext } from '@/lib/github/resolve-auth';
import type { FileChange } from '@/lib/github/types';

interface RefResponse {
  object: { sha: string };
}

interface PullResponse {
  number: number;
  html_url: string;
}

interface ContentShaResponse {
  sha: string;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function toFetchOptions(auth?: GitHubAuthContext): GitHubFetchOptions {
  if (!auth) return {};
  return { token: auth.token, installationId: auth.installationId };
}

export async function createPullRequestFromChanges(params: {
  owner: string;
  repo: string;
  defaultBranch: string;
  changes: FileChange[];
  prTitle: string;
  prBody: string;
  githubAuth?: GitHubAuthContext;
}): Promise<{ prUrl: string; prNumber: number; branchName: string }> {
  const { owner, repo, defaultBranch, changes, prTitle, prBody, githubAuth } = params;
  const fetchOpts = toFetchOptions(githubAuth);

  const baseRef = await githubFetch<RefResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    fetchOpts
  );

  const branchName = `synapsecro/audit-${Date.now()}`;

  await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    }),
    ...fetchOpts,
  });

  for (const change of changes) {
    let existingSha: string | undefined;

    try {
      const existing = await githubFetch<ContentShaResponse>(
        `/repos/${owner}/${repo}/contents/${encodePath(change.path)}?ref=${encodeURIComponent(branchName)}`,
        fetchOpts
      );
      existingSha = existing.sha;
    } catch {
      existingSha = undefined;
    }

    await githubFetch(`/repos/${owner}/${repo}/contents/${encodePath(change.path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: change.message,
        content: Buffer.from(change.content, 'utf-8').toString('base64'),
        branch: branchName,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
      ...fetchOpts,
    });
  }

  const pull = await githubFetch<PullResponse>(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: prTitle,
      head: branchName,
      base: defaultBranch,
      body: prBody,
    }),
    ...fetchOpts,
  });

  void notifySlack(
    [
      '🔀 SynapseCRO PR created',
      prTitle,
      pull.html_url,
      `Repo: ${owner}/${repo}`,
    ].join('\n')
  );

  return {
    prUrl: pull.html_url,
    prNumber: pull.number,
    branchName,
  };
}
