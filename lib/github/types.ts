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
  created_at: string;
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
