import { createSign } from 'crypto';
import { getGitHubAppId, getGitHubAppPrivateKey, hasGitHubAppConfig } from '@/lib/env';

export { hasGitHubAppConfig };

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<number, CachedToken>();

/** Refresh cached tokens at least 5 minutes before GitHub's 1-hour expiry. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function normalizePrivateKey(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

function createAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();

  const signature = sign.sign(normalizePrivateKey(privateKeyPem), 'base64url');
  return `${signingInput}.${signature}`;
}

export function getAppJwt(): string {
  const appId = getGitHubAppId();
  const privateKey = getGitHubAppPrivateKey();
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials are not configured');
  }
  return createAppJwt(appId, privateKey);
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return cached.token;
  }

  const jwt = getAppJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
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
      `Failed to create installation token (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as InstallationTokenResponse;
  const expiresAt = new Date(data.expires_at).getTime();

  tokenCache.set(installationId, {
    token: data.token,
    expiresAt,
  });

  return data.token;
}

/** Clear cached token (e.g. after installation deletion). */
export function invalidateInstallationToken(installationId: number): void {
  tokenCache.delete(installationId);
}
