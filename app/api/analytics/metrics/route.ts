import { NextResponse } from 'next/server';
import { getDashboardAnalyticsMetrics } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';

export async function GET() {
  const metrics = await getDashboardAnalyticsMetrics();
  if (!metrics) {
    return NextResponse.json({ error: 'Analytics not configured' }, { status: 503 });
  }

  return NextResponse.json(metrics);
}
