import { NextResponse } from 'next/server';
import { getClickHouseShowcase } from '@/lib/clickhouse/showcase';

export const runtime = 'nodejs';

/** Judge-facing snapshot: scale stats, persistent SEO issues, prompt preview, example SQL. */
export async function GET() {
  const showcase = await getClickHouseShowcase();
  if (!showcase) {
    return NextResponse.json({ error: 'ClickHouse not configured' }, { status: 503 });
  }
  return NextResponse.json(showcase);
}
