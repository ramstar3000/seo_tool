import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAnalyticsEvent } from '@/lib/clickhouse/events';
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const analyticsBodySchema = z.object({
  event_type: z.enum(['page_view', 'cta_click']),
  path: z.string().max(500).optional(),
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

  const referrer = request.headers.get('referer') ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';

  const { error } = await supabase.from('analytics_events').insert({
    event_type: body.event_type,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }

  void recordAnalyticsEvent({
    eventType: body.event_type,
    path: body.path ?? '/',
    referrer,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
