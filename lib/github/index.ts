export {
  GitHubApiError,
  githubFetch,
  isGitHubConfigured,
  type GitHubFetchOptions,
} from '@/lib/github/client';
export { hasGitHubAppConfig, getInstallationToken } from '@/lib/github/app-auth';
export {
  getInstallationForUser,
  saveInstallation,
  deleteInstallation,
  listInstallationRepos,
} from '@/lib/github/installations';
export { resolveGitHubAuth, isGitHubAuthAvailable, isGitHubServerConfigured } from '@/lib/github/resolve-auth';
export { parseRepoUrl } from '@/lib/github/parse-repo-url';
export { applyFindingsToRepo } from '@/lib/github/apply-findings';
export { autoApplyFromAudit } from '@/lib/github/auto-apply-from-audit';
export { createPullRequestFromChanges } from '@/lib/github/create-pr';
export {
  isBlockedPath,
  isAllowedContentPath,
  filterSafeFileChanges,
  pickCandidatePaths,
  scoreCandidatePath,
  MAX_FILES_PER_PR,
} from '@/lib/github/path-guardrails';
export type {
  ParsedRepoUrl,
  LinkedRepository,
  RepoChangeRun,
  FileChange,
  AuditFindingInput,
  GitHubInstallationSummary,
  RepositoryListItem,
} from '@/lib/github/types';
