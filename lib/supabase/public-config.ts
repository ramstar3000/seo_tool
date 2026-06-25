import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
