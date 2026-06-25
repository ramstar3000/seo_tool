import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type RequireUserResult =
  | { user: User; supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>> }
  | { error: NextResponse };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: 'Supabase not configured' }, { status: 503 }),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, supabase };
}
