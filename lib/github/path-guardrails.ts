const BLOCKED_PATTERNS = [
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.env/i,
  /(^|\/)\.env\./i,
  /(^|\/)secrets?(\/|$)/i,
  /(^|\/)credentials(\/|$)/i,
  /\.pem$/i,
  /\.key$/i,
];

const ALLOWED_EXTENSIONS = new Set([
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
  '.html',
  '.htm',
  '.md',
  '.mdx',
  '.json',
  '.txt',
  '.yaml',
  '.yml',
  '.vue',
  '.astro',
  '.xml',
  '.csv',
]);

export const MAX_FILES_PER_PR = 5;

export function isBlockedPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').trim();
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isAllowedContentPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').trim();
  if (isBlockedPath(normalized)) return false;

  const dot = normalized.lastIndexOf('.');
  if (dot === -1) {
    return normalized.endsWith('Dockerfile') || normalized.endsWith('LICENSE');
  }

  const ext = normalized.slice(dot).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export function filterSafeFileChanges<T extends { path: string }>(
  changes: T[],
  maxFiles = MAX_FILES_PER_PR
): T[] {
  return changes
    .filter((c) => isAllowedContentPath(c.path) && !isBlockedPath(c.path))
    .slice(0, maxFiles);
}

const CANDIDATE_HINTS = [
  'hero',
  'title',
  'meta',
  'seo',
  'head',
  'layout',
  'page',
  'index',
  'home',
  'landing',
  'content',
  'copy',
  'schema',
  'og',
  'sitemap',
];

export function scoreCandidatePath(path: string, contentPaths: string[]): number {
  const lower = path.toLowerCase();

  if (contentPaths.some((hint) => lower === hint.toLowerCase() || lower.endsWith(`/${hint.toLowerCase()}`))) {
    return 100;
  }

  let score = 0;
  for (const hint of CANDIDATE_HINTS) {
    if (lower.includes(hint)) score += 10;
  }

  if (ALLOWED_EXTENSIONS.has(lower.slice(lower.lastIndexOf('.')).toLowerCase())) {
    score += 1;
  }

  return score;
}

export function pickCandidatePaths(
  treePaths: string[],
  contentPaths: string[],
  limit = MAX_FILES_PER_PR * 2
): string[] {
  const allowed = treePaths.filter((p) => isAllowedContentPath(p) && !isBlockedPath(p));

  const explicit = contentPaths.filter((p) => allowed.includes(p));
  const scored = allowed
    .filter((p) => !explicit.includes(p))
    .map((p) => ({ path: p, score: scoreCandidatePath(p, contentPaths) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.path);

  return [...new Set([...explicit, ...scored])].slice(0, limit);
}
