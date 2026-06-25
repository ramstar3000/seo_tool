import { githubFetch } from '@/lib/github/client';
import { notifySlack } from '@/lib/notifications/slack';
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

export async function createPullRequestFromChanges(params: {
  owner: string;
  repo: string;
  defaultBranch: string;
  changes: FileChange[];
  prTitle: string;
  prBody: string;
}): Promise<{ prUrl: string; prNumber: number; branchName: string }> {
  const { owner, repo, defaultBranch, changes, prTitle, prBody } = params;

  const baseRef = await githubFetch<RefResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`
  );

  const branchName = `synapsecro/audit-${Date.now()}`;

  await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    }),
  });

  for (const change of changes) {
    let existingSha: string | undefined;

    try {
      const existing = await githubFetch<ContentShaResponse>(
        `/repos/${owner}/${repo}/contents/${encodePath(change.path)}?ref=${encodeURIComponent(branchName)}`
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
