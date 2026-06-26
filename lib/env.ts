export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}

export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
}

/** All-time LLM spend cap in USD (default $30). Applies to Gemini and Anthropic usage. */
export function getGeminiSpendCapUsd(): number {
  const raw = process.env.GEMINI_SPEND_CAP_USD;
  if (raw === undefined || raw.trim() === '') return 30;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

/** Optional global cap across all tracked API providers. */
export function getGlobalSpendCapUsd(): number | null {
  const raw = process.env.GLOBAL_SPEND_CAP_USD;
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getTavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY;
}

/** @deprecated Use getTavilyApiKey */
export function getSerpApiKey(): string | undefined {
  return getTavilyApiKey();
}

export function getGooglePlacesApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY;
}

export function getFirecrawlApiKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY;
}

export function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

export function getGitHubAppId(): string | undefined {
  return process.env.GITHUB_APP_ID?.trim() || undefined;
}

export function getGitHubAppPrivateKey(): string | undefined {
  return process.env.GITHUB_APP_PRIVATE_KEY?.trim() || undefined;
}

export function getGitHubAppSlug(): string | undefined {
  return process.env.GITHUB_APP_SLUG?.trim() || undefined;
}

export function getGitHubAppWebhookSecret(): string | undefined {
  return process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || undefined;
}

export function hasGitHubAppConfig(): boolean {
  return Boolean(getGitHubAppId() && getGitHubAppPrivateKey() && getGitHubAppSlug());
}

/** "owner/name" of this app's own repo — target for prompt self-improvement PRs. */
export function getAppGitHubRepo(): string | undefined {
  return process.env.APP_GITHUB_REPO?.trim() || undefined;
}

export function getGooglePageSpeedApiKey(): string | undefined {
  return process.env.GOOGLE_PAGESPEED_API_KEY ?? process.env.GOOGLE_API_KEY;
}

export function getSlackWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL;
}

export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'SynapseCRO <onboarding@resend.dev>';
}

/** Inbox that prospect replies land in. Sending is via a cold-send domain, but replies go here. */
export function getResendReplyToEmail(): string {
  return process.env.RESEND_REPLY_TO_EMAIL?.trim() || 'ram+seo@acyclic.dev';
}

/** Fallback recipient when leads have no prospect email (demo / draft workflow). */
export function getOutreachTargetEmail(): string | undefined {
  return process.env.OUTREACH_TARGET_EMAIL?.trim() || undefined;
}

export function hasResendConfig(): boolean {
  return Boolean(getResendApiKey());
}

export function hasOutreachSendConfig(): boolean {
  return hasResendConfig() && Boolean(getOutreachTargetEmail());
}

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function hasAnthropicConfig(): boolean {
  return Boolean(getAnthropicApiKey());
}

export function hasGeminiConfig(): boolean {
  return Boolean(getGeminiApiKey());
}

export function hasLlmConfig(): boolean {
  return hasGeminiConfig() || hasAnthropicConfig();
}

export function hasTavilyConfig(): boolean {
  return Boolean(getTavilyApiKey());
}

/** ClickHouse Cloud URL (e.g. https://xxx.eu-west-1.aws.clickhouse.cloud:8443). */
export function getClickHouseUrl(): string | undefined {
  return process.env.CLICKHOUSE_URL?.trim() || undefined;
}

export function getClickHouseUser(): string {
  return process.env.CLICKHOUSE_USER?.trim() || 'default';
}

export function getClickHousePassword(): string {
  return process.env.CLICKHOUSE_PASSWORD ?? '';
}

export function getClickHouseDatabase(): string {
  return process.env.CLICKHOUSE_DATABASE?.trim() || 'default';
}

/** True when CLICKHOUSE_URL is set (empty password OK for local Docker). */
export function hasClickHouseConfig(): boolean {
  return Boolean(getClickHouseUrl());
}
