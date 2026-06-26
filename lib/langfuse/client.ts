import { Langfuse } from 'langfuse';

let client: Langfuse | null = null;

export function getLangfusePublicKey(): string | undefined {
  return process.env.LANGFUSE_PUBLIC_KEY?.trim() || process.env.LANGFUSE_PK?.trim();
}

export function getLangfuseSecretKey(): string | undefined {
  return process.env.LANGFUSE_SECRET_KEY?.trim() || process.env.LANGFUSE_SK?.trim();
}

export function getLangfuseBaseUrl(): string {
  return process.env.LANGFUSE_BASE_URL?.trim() || 'https://cloud.langfuse.com';
}

export function hasLangfuseConfig(): boolean {
  return Boolean(getLangfusePublicKey() && getLangfuseSecretKey());
}

export function getLangfuseClient(): Langfuse | null {
  if (!hasLangfuseConfig()) return null;

  if (!client) {
    client = new Langfuse({
      publicKey: getLangfusePublicKey()!,
      secretKey: getLangfuseSecretKey()!,
      baseUrl: getLangfuseBaseUrl(),
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.FLY_APP_NAME ?? 'local',
    });
  }

  return client;
}

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuseClient();
  if (!lf) return;
  await lf.flushAsync();
}
