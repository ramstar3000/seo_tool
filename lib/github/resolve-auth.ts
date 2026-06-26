import { getGitHubToken } from '@/lib/env';
import { getInstallationToken, hasGitHubAppConfig } from '@/lib/github/app-auth';
import { getInstallationForUser } from '@/lib/github/installations';

export interface GitHubAuthContext {
  token?: string;
  installationId?: number;
}

/**
 * Resolve GitHub credentials for API calls: installation token first, PAT fallback.
 * Returns null when neither is available for the given user.
 */
export async function resolveGitHubAuth(
  userId: string,
  repoInstallationId?: number | null
): Promise<GitHubAuthContext | null> {
  let installationId = repoInstallationId ?? undefined;

  if (!installationId && hasGitHubAppConfig()) {
    const installation = await getInstallationForUser(userId);
    installationId = installation?.installation_id;
  }

  if (installationId) {
    try {
      const token = await getInstallationToken(installationId);
      return { token, installationId };
    } catch {
      // Fall through to PAT when installation token exchange fails.
    }
  }

  const pat = getGitHubToken();
  if (pat) {
    return { token: pat };
  }

  return null;
}

/** True when a shared PAT is configured or the user has a GitHub App installation. */
export async function isGitHubAuthAvailable(userId: string): Promise<boolean> {
  if (getGitHubToken()) {
    return true;
  }
  if (!hasGitHubAppConfig()) {
    return false;
  }
  const installation = await getInstallationForUser(userId);
  return Boolean(installation);
}

/** True when PAT or GitHub App env vars are present (server-wide). */
export function isGitHubServerConfigured(): boolean {
  return Boolean(getGitHubToken()) || hasGitHubAppConfig();
}
