import type { ParsedRepoUrl } from '@/lib/github/types';

const GITHUB_HTTPS_RE = /^https?:\/\/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/|$|\?|#)/i;
const GITHUB_SSH_RE = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i;

export function parseRepoUrl(input: string): ParsedRepoUrl | null {
  const trimmed = input.trim();

  let owner: string | undefined;
  let repo: string | undefined;

  const httpsMatch = trimmed.match(GITHUB_HTTPS_RE);
  if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  } else {
    const sshMatch = trimmed.match(GITHUB_SSH_RE);
    if (sshMatch) {
      owner = sshMatch[1];
      repo = sshMatch[2];
    } else if (/^[^/]+\/[^/]+$/.test(trimmed)) {
      [owner, repo] = trimmed.split('/');
    }
  }

  if (!owner || !repo) return null;

  owner = owner.replace(/\.git$/i, '');
  repo = repo.replace(/\.git$/i, '');

  return {
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
}
