import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import type { PublicSupabaseConfig } from '@/lib/supabase/public-config';

let runtimeConfig: PublicSupabaseConfig | null = null;

export function setBrowserSupabaseConfig(config: PublicSupabaseConfig | null): void {
  runtimeConfig = config;
}

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const url = runtimeConfig?.url ?? getSupabaseUrl();
  const key = runtimeConfig?.anonKey ?? getSupabaseAnonKey();
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
