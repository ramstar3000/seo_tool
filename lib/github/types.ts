export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  repoUrl: string;
}

export interface LinkedRepository {
  id: string;
  lead_id: string | null;
  audit_id: string | null;
  label: string | null;
  github_owner: string;
  github_repo: string;
  default_branch: string;
  repo_url: string;
  content_paths: string[];
  installation_id?: number | null;
  created_at: string;
}

export interface GitHubInstallationSummary {
  installation_id: number;
  account_login: string;
  account_type: 'User' | 'Organization';
}

/** Repo returned by GitHub GET /installation/repositories. */
export interface GitHubInstallationRepo {
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
}

/** Settings page: GitHub App repo merged with optional lead link. */
export interface RepositoryListItem {
  full_name: string;
  html_url: string;
  default_branch: string;
  private?: boolean;
  app_access: boolean;
  linked: LinkedRepository | null;
}

export interface RepoChangeRun {
  id: string;
  repository_id: string;
  audit_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  pr_url: string | null;
  pr_number: number | null;
  branch_name: string | null;
  change_summary: string | null;
  files_changed: string[] | null;
  error_message: string | null;
  created_at: string;
}

export interface FileChange {
  path: string;
  content: string;
  message: string;
}

/**
 * A surgical edit the model proposes: replace an exact `oldString` snippet
 * copied verbatim from the file with `newString`. Applied server-side so
 * untouched lines stay byte-identical (no whole-file rewrites).
 */
export interface FileEdit {
  path: string;
  oldString: string;
  newString: string;
  message: string;
}

export interface AuditFindingInput {
  severity: string;
  category: string;
  title: string;
  description: string;
}
