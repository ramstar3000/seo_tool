import { runLlmText } from '@/lib/llm/generate';
import { githubFetch } from '@/lib/github/client';
import {
  filterSafeFileChanges,
  MAX_FILES_PER_PR,
  pickCandidatePaths,
} from '@/lib/github/path-guardrails';
import type { AuditFindingInput, FileChange } from '@/lib/github/types';
import {
  buildGitHubChangesUserPrompt,
  GITHUB_CHANGES_SYSTEM_PROMPT,
} from '@/lib/prompts/github-changes';

interface GitTreeResponse {
  tree: Array<{ path: string; type: string }>;
}

interface ContentResponse {
  content: string;
  encoding: string;
  sha: string;
}

function decodeContent(data: ContentResponse): string {
  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }
  return data.content;
}

async function fetchRepoTree(owner: string, repo: string, branch: string): Promise<string[]> {
  const ref = await githubFetch<{ object: { sha: string } }>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );

  const tree = await githubFetch<GitTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${ref.object.sha}?recursive=1`
  );

  return tree.tree.filter((item) => item.type === 'blob').map((item) => item.path);
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<{ path: string; content: string } | null> {
  try {
    const data = await githubFetch<ContentResponse>(
      `/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`
    );
    return { path, content: decodeContent(data) };
  } catch {
    return null;
  }
}

function parseChangesJson(raw: string): FileChange[] {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('[')
    ? trimmed
    : trimmed.match(/\[[\s\S]*\]/)?.[0];

  if (!jsonText) {
    throw new Error('Model did not return a JSON array of file changes');
  }

  const parsed = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of file changes');
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.path !== 'string' || typeof row.content !== 'string') return null;
      return {
        path: row.path,
        content: row.content,
        message: typeof row.message === 'string' ? row.message : 'Apply SEO/CRO improvements',
      };
    })
    .filter((item): item is FileChange => item !== null);
}

export async function applyFindingsToRepo(params: {
  owner: string;
  repo: string;
  defaultBranch: string;
  contentPaths: string[];
  businessName: string;
  keyword: string;
  findings: AuditFindingInput[];
  seoContext?: string;
}): Promise<{ changes: FileChange[]; summary: string }> {
  const { owner, repo, defaultBranch, contentPaths, businessName, keyword, findings, seoContext } =
    params;

  const treePaths = await fetchRepoTree(owner, repo, defaultBranch);
  const candidatePaths = pickCandidatePaths(treePaths, contentPaths, MAX_FILES_PER_PR * 2);

  if (candidatePaths.length === 0) {
    throw new Error('No editable marketing files found in repository');
  }

  const fileContents = (
    await Promise.all(
      candidatePaths.map((path) => fetchFileContent(owner, repo, path, defaultBranch))
    )
  ).filter((item): item is { path: string; content: string } => item !== null);

  if (fileContents.length === 0) {
    throw new Error('Could not read candidate file contents from repository');
  }

  const textBlock = await runLlmText({
    system: GITHUB_CHANGES_SYSTEM_PROMPT,
    prompt: buildGitHubChangesUserPrompt({
      businessName,
      keyword,
      findings,
      files: fileContents,
      seoContext,
    }),
    maxOutputTokens: 8192,
    telemetry: { functionId: 'github-apply-findings' },
  });

  const rawChanges = parseChangesJson(textBlock);
  const allowedPaths = new Set(fileContents.map((f) => f.path));
  const safeChanges = filterSafeFileChanges(
    rawChanges.filter((c) => allowedPaths.has(c.path))
  );

  if (safeChanges.length === 0) {
    throw new Error('No safe file changes generated (check path guardrails or findings)');
  }

  const summary = safeChanges.map((c) => c.message).join('; ');

  return { changes: safeChanges, summary };
}
