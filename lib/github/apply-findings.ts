import { z } from 'zod';
import { runLlmObject } from '@/lib/llm/generate';
import { githubFetch, type GitHubFetchOptions } from '@/lib/github/client';
import type { GitHubAuthContext } from '@/lib/github/resolve-auth';
import {
  filterSafeFileChanges,
  MAX_FILES_PER_PR,
  pickCandidatePaths,
} from '@/lib/github/path-guardrails';
import type { AuditFindingInput, FileChange, FileEdit } from '@/lib/github/types';
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

function toFetchOptions(auth?: GitHubAuthContext): GitHubFetchOptions {
  if (!auth) return {};
  return { token: auth.token, installationId: auth.installationId };
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  auth?: GitHubAuthContext
): Promise<string[]> {
  const fetchOpts = toFetchOptions(auth);
  const ref = await githubFetch<{ object: { sha: string } }>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    fetchOpts
  );

  const tree = await githubFetch<GitTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${ref.object.sha}?recursive=1`,
    fetchOpts
  );

  return tree.tree.filter((item) => item.type === 'blob').map((item) => item.path);
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  auth?: GitHubAuthContext
): Promise<{ path: string; content: string } | null> {
  try {
    const data = await githubFetch<ContentResponse>(
      `/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
      toFetchOptions(auth)
    );
    return { path, content: decodeContent(data) };
  } catch {
    return null;
  }
}

const FileEditSchema = z.object({
  path: z.string(),
  oldString: z.string(),
  newString: z.string(),
  message: z.string().optional(),
});

const EditsResponseSchema = z.object({
  edits: z.array(FileEditSchema),
});

function normalizeEdits(raw: z.infer<typeof EditsResponseSchema>): FileEdit[] {
  return raw.edits
    // A no-op edit (old === new) or empty match can't replace anything; drop it.
    .filter((e) => e.oldString.length > 0 && e.oldString !== e.newString)
    .map((e) => ({
      path: e.path,
      oldString: e.oldString,
      newString: e.newString,
      message: e.message?.trim() || 'Apply SEO/CRO improvements',
    }));
}

/**
 * Apply surgical find/replace edits to the original file contents. Each edit's
 * oldString must match its file exactly and uniquely; non-matching or ambiguous
 * edits are skipped (not force-applied) so we never corrupt untouched code.
 * Returns one FileChange per touched file with the recomputed full content.
 */
function applyEditsToFiles(
  edits: FileEdit[],
  fileContents: Array<{ path: string; content: string }>
): FileChange[] {
  const originalByPath = new Map(fileContents.map((f) => [f.path, f.content]));
  const working = new Map<string, { content: string; messages: string[] }>();

  for (const edit of edits) {
    const base = working.get(edit.path)?.content ?? originalByPath.get(edit.path);
    if (base === undefined) continue; // path not among provided files

    const firstIdx = base.indexOf(edit.oldString);
    if (firstIdx === -1) continue; // snippet not found — skip rather than guess
    const lastIdx = base.lastIndexOf(edit.oldString);
    if (firstIdx !== lastIdx) continue; // ambiguous (multiple matches) — skip

    const nextContent =
      base.slice(0, firstIdx) + edit.newString + base.slice(firstIdx + edit.oldString.length);

    const entry = working.get(edit.path) ?? { content: base, messages: [] };
    entry.content = nextContent;
    entry.messages.push(edit.message);
    working.set(edit.path, entry);
  }

  return [...working.entries()]
    .filter(([path, entry]) => entry.content !== originalByPath.get(path))
    .map(([path, entry]) => ({
      path,
      content: entry.content,
      message: entry.messages.join('; ') || 'Apply SEO/CRO improvements',
    }));
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
  githubAuth?: GitHubAuthContext;
}): Promise<{ changes: FileChange[]; summary: string }> {
  const {
    owner,
    repo,
    defaultBranch,
    contentPaths,
    businessName,
    keyword,
    findings,
    seoContext,
    githubAuth,
  } = params;

  const treePaths = await fetchRepoTree(owner, repo, defaultBranch, githubAuth);
  const candidatePaths = pickCandidatePaths(treePaths, contentPaths, MAX_FILES_PER_PR * 2);

  if (candidatePaths.length === 0) {
    throw new Error('No editable marketing files found in repository');
  }

  const fileContents = (
    await Promise.all(
      candidatePaths.map((path) => fetchFileContent(owner, repo, path, defaultBranch, githubAuth))
    )
  ).filter((item): item is { path: string; content: string } => item !== null);

  if (fileContents.length === 0) {
    throw new Error('Could not read candidate file contents from repository');
  }

  const response = await runLlmObject({
    system: GITHUB_CHANGES_SYSTEM_PROMPT,
    prompt: buildGitHubChangesUserPrompt({
      businessName,
      keyword,
      findings,
      files: fileContents,
      seoContext,
    }),
    schema: EditsResponseSchema,
    telemetry: { functionId: 'github-apply-findings' },
  });

  const edits = normalizeEdits(response);
  const allowedPaths = new Set(fileContents.map((f) => f.path));
  const changes = applyEditsToFiles(
    edits.filter((e) => allowedPaths.has(e.path)),
    fileContents
  );
  const safeChanges = filterSafeFileChanges(changes);

  if (safeChanges.length === 0) {
    throw new Error(
      'No applicable edits were generated. The model may not have found exact text to change ' +
        '(check the linked content path hints and audit findings), then retry.'
    );
  }

  const summary = safeChanges.map((c) => c.message).join('; ');

  return { changes: safeChanges, summary };
}
