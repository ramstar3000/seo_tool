import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';

export type AnalyticsEventType = 'page_view' | 'cta_click';

export interface RecordAnalyticsEventParams {
  eventType: AnalyticsEventType;
  path?: string;
  referrer?: string;
  userAgent?: string;
}

export interface ConversionMetrics {
  pageViews: number;
  ctaClicks: number;
  conversionRate: number | null;
}

export interface HourlyFunnelRow {
  hour: string;
  pageViews: number;
  ctaClicks: number;
  conversionRate: number | null;
}

export interface AnalyticsMetrics {
  source: 'clickhouse' | 'supabase';
  totals: ConversionMetrics;
  hourly: HourlyFunnelRow[];
}

function computeConversionRate(pageViews: number, ctaClicks: number): number | null {
  if (pageViews <= 0) return null;
  return Math.round((ctaClicks / pageViews) * 1000) / 10;
}

export async function recordAnalyticsEvent(params: RecordAnalyticsEventParams): Promise<void> {
  const client = getClickHouseClient();
  if (!client) return;

  const ready = await ensureClickHouseSchema();
  if (!ready) return;

  try {
    await client.insert({
      table: 'analytics_events',
      values: [
        {
          event_type: params.eventType,
          path: params.path ?? '/',
          referrer: params.referrer ?? '',
          user_agent: params.userAgent ?? '',
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (error) {
    console.error('[clickhouse] failed to record analytics event:', error);
  }
}

export async function getConversionMetrics(days = 30): Promise<ConversionMetrics | null> {
  const client = getClickHouseClient();
  if (!client) return null;

  const ready = await ensureClickHouseSchema();
  if (!ready) return null;

  try {
    const result = await client.query({
      query: `
        SELECT
          countIf(event_type = 'page_view') AS page_views,
          countIf(event_type = 'cta_click') AS cta_clicks
        FROM analytics_events
        WHERE created_at >= now() - INTERVAL {days:UInt16} DAY
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as { page_views: string; cta_clicks: string }[];
    const row = rows[0];
    if (!row) return { pageViews: 0, ctaClicks: 0, conversionRate: null };

    const pageViews = Number(row.page_views ?? 0);
    const ctaClicks = Number(row.cta_clicks ?? 0);

    return {
      pageViews,
      ctaClicks,
      conversionRate: computeConversionRate(pageViews, ctaClicks),
    };
  } catch (error) {
    console.error('[clickhouse] failed to read conversion metrics:', error);
    return null;
  }
}

export async function getHourlyFunnel(days = 7): Promise<HourlyFunnelRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          toStartOfHour(created_at) AS hour,
          countIf(event_type = 'page_view') AS page_views,
          countIf(event_type = 'cta_click') AS cta_clicks
        FROM analytics_events
        WHERE created_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY hour
        ORDER BY hour ASC
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      hour: string;
      page_views: string;
      cta_clicks: string;
    }[];

    return rows.map((row) => {
      const pageViews = Number(row.page_views ?? 0);
      const ctaClicks = Number(row.cta_clicks ?? 0);
      return {
        hour: row.hour,
        pageViews,
        ctaClicks,
        conversionRate: computeConversionRate(pageViews, ctaClicks),
      };
    });
  } catch (error) {
    console.error('[clickhouse] failed to read hourly funnel:', error);
    return [];
  }
}

export async function getAnalyticsMetrics(): Promise<AnalyticsMetrics | null> {
  const totals = await getConversionMetrics(30);
  if (!totals) return null;

  const hourly = await getHourlyFunnel(7);
  return { source: 'clickhouse', totals, hourly };
}
