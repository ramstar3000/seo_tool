import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const analyticsBodySchema = z.object({
  event_type: z.enum(['page_view', 'cta_click']),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`analytics:${ip}`, 30, 60_000);

  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfterSeconds);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let body: z.infer<typeof analyticsBodySchema>;
  try {
    body = analyticsBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { error } = await supabase.from('analytics_events').insert({
    event_type: body.event_type,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
