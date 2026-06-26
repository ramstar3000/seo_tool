import { NextRequest, NextResponse } from 'next/server';
import { getSeoPromptContext } from '@/lib/clickhouse/seo-insights';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const leadId = searchParams.get('leadId') ?? undefined;
  const auditId = searchParams.get('auditId') ?? undefined;
  const keyword = searchParams.get('keyword') ?? undefined;
  const daysRaw = searchParams.get('days');
  const days = daysRaw ? Number(daysRaw) : undefined;

  const context = await getSeoPromptContext({
    leadId,
    auditId,
    keyword,
    days: Number.isFinite(days) && days! > 0 ? days : undefined,
  });

  if (context.source === 'none') {
    return NextResponse.json({ error: 'ClickHouse SEO insights not configured' }, { status: 503 });
  }

  return NextResponse.json(context);
}
