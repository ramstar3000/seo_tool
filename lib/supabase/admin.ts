import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key);
}
