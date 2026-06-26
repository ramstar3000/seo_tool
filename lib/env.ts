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
  return process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
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

export function getGooglePageSpeedApiKey(): string | undefined {
  return process.env.GOOGLE_PAGESPEED_API_KEY;
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
