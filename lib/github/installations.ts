import { githubFetch } from '@/lib/github/client';
import { getAppJwt } from '@/lib/github/app-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface GitHubInstallation {
  id: string;
  user_id: string;
  installation_id: number;
  account_login: string;
  account_type: 'User' | 'Organization';
  created_at: string;
  updated_at: string;
}

interface GitHubInstallationApiResponse {
  id: number;
  account: {
    login: string;
    type: 'User' | 'Organization';
  };
}

interface InstallationRepoItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch?: string;
}

interface InstallationReposResponse {
  total_count: number;
  repositories: InstallationRepoItem[];
}

function mapInstallation(row: Record<string, unknown>): GitHubInstallation {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    installation_id: Number(row.installation_id),
    account_login: row.account_login as string,
    account_type: row.account_type as 'User' | 'Organization',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function fetchInstallationFromGitHub(
  installationId: number
): Promise<{ account_login: string; account_type: 'User' | 'Organization' }> {
  const jwt = getAppJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch GitHub installation (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as GitHubInstallationApiResponse;
  return {
    account_login: data.account.login,
    account_type: data.account.type,
  };
}

export async function saveInstallation(params: {
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
}): Promise<GitHubInstallation> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('github_installations')
    .upsert(
      {
        user_id: params.userId,
        installation_id: params.installationId,
        account_login: params.accountLogin,
        account_type: params.accountType,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save GitHub installation');
  }

  // Stamp installation_id on repos owned by this user that lack one.
  await supabase
    .from('linked_repositories')
    .update({ installation_id: params.installationId })
    .eq('user_id', params.userId)
    .is('installation_id', null);

  return mapInstallation(data as Record<string, unknown>);
}

export async function getInstallationForUser(
  userId: string
): Promise<GitHubInstallation | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('github_installations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapInstallation(data as Record<string, unknown>);
}

export async function getInstallationByInstallationId(
  installationId: number
): Promise<GitHubInstallation | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('github_installations')
    .select('*')
    .eq('installation_id', installationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapInstallation(data as Record<string, unknown>);
}

export async function deleteInstallation(installationId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('github_installations')
    .delete()
    .eq('installation_id', installationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteInstallationForUser(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('github_installations')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listInstallationRepos(
  installationId: number
): Promise<InstallationRepoItem[]> {
  const repos: InstallationRepoItem[] = [];
  let page = 1;

  while (true) {
    const response = await githubFetch<InstallationReposResponse>(
      `/installation/repositories?per_page=100&page=${page}`,
      { installationId }
    );

    repos.push(...response.repositories);

    if (repos.length >= response.total_count || response.repositories.length === 0) {
      break;
    }
    page += 1;
  }

  return repos;
}
