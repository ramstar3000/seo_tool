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

export function getSerpApiKey(): string | undefined {
  return process.env.SERPAPI_KEY;
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
