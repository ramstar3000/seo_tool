import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

export async function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll from a Server Component — middleware will refresh the session.
        }
      },
    },
  });
}
