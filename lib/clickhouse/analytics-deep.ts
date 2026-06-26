import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';

export interface DailyConversionRow {
  day: string;
  pageViews: number;
  ctaClicks: number;
  conversionRate: number | null;
}

export interface RankTrajectoryRow {
  completedAt: string;
  rankPosition: number | null;
  lcpMs: number | null;
  criticalCount: number;
  businessName: string;
  keyword: string;
}

export interface CategoryHeatmapRow {
  week: string;
  category: string;
  critical: number;
  warning: number;
}

export interface QueryTiming {
  name: string;
  elapsedMs: number;
  rowCount: number;
}

async function timedQuery(
  name: string,
  query: string,
  queryParams?: Record<string, unknown>
): Promise<{ rows: Record<string, unknown>[]; timing: QueryTiming }> {
  const client = getClickHouseClient();
  if (!client) return { rows: [], timing: { name, elapsedMs: 0, rowCount: 0 } };

  const start = performance.now();
  const result = await client.query({
    query,
    query_params: queryParams,
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Record<string, unknown>[];
  return {
    rows,
    timing: { name, elapsedMs: Math.round(performance.now() - start), rowCount: rows.length },
  };
}

export async function getDailyConversionTrend(days = 30): Promise<DailyConversionRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const { rows } = await timedQuery(
      'daily_conversion',
      `
        SELECT
          toDate(created_at) AS day,
          countIf(event_type = 'page_view') AS page_views,
          countIf(event_type = 'cta_click') AS cta_clicks
        FROM analytics_events
        WHERE created_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY day
        ORDER BY day ASC
      `,
      { days }
    );

    return rows.map((row) => {
      const pageViews = Number(row.page_views ?? 0);
      const ctaClicks = Number(row.cta_clicks ?? 0);
      return {
        day: String(row.day),
        pageViews,
        ctaClicks,
        conversionRate: pageViews > 0 ? Math.round((ctaClicks / pageViews) * 1000) / 10 : null,
      };
    });
  } catch (error) {
    console.error('[clickhouse] daily conversion trend failed:', error);
    return [];
  }
}

export async function getHourlyFunnelFromMv(days = 7): Promise<DailyConversionRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          hour AS day,
          sumIf(event_count, event_type = 'page_view') AS page_views,
          sumIf(event_count, event_type = 'cta_click') AS cta_clicks
        FROM analytics_hourly_agg
        WHERE hour >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY hour
        ORDER BY hour ASC
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      day: string;
      page_views: string;
      cta_clicks: string;
    }[];

    return rows.map((row) => {
      const pageViews = Number(row.page_views ?? 0);
      const ctaClicks = Number(row.cta_clicks ?? 0);
      return {
        day: row.day,
        pageViews,
        ctaClicks,
        conversionRate: pageViews > 0 ? Math.round((ctaClicks / pageViews) * 1000) / 10 : null,
      };
    });
  } catch {
    return [];
  }
}

export async function getRankTrajectory(params: {
  leadId?: string;
  keyword?: string;
  days?: number;
}): Promise<RankTrajectoryRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  const days = params.days ?? 90;
  const conditions = [
    "event_type = 'audit_summary'",
    'completed_at >= now() - INTERVAL {days:UInt16} DAY',
  ];
  const queryParams: Record<string, unknown> = { days };

  if (params.leadId) {
    conditions.push('lead_id = {leadId:UUID}');
    queryParams.leadId = params.leadId;
  }
  if (params.keyword) {
    conditions.push('keyword = {keyword:String}');
    queryParams.keyword = params.keyword;
  }

  try {
    const result = await client.query({
      query: `
        SELECT completed_at, rank_position, lcp_ms, critical_count, business_name, keyword
        FROM seo_insight_events
        WHERE ${conditions.join(' AND ')}
        ORDER BY completed_at ASC
      `,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      completed_at: string;
      rank_position: string | null;
      lcp_ms: string | null;
      critical_count: string;
      business_name: string;
      keyword: string;
    }[];

    return rows.map((row) => ({
      completedAt: row.completed_at,
      rankPosition: row.rank_position === null ? null : Number(row.rank_position),
      lcpMs: row.lcp_ms === null ? null : Number(row.lcp_ms),
      criticalCount: Number(row.critical_count ?? 0),
      businessName: row.business_name,
      keyword: row.keyword,
    }));
  } catch (error) {
    console.error('[clickhouse] rank trajectory failed:', error);
    return [];
  }
}

export async function getCategoryHeatmap(days = 90): Promise<CategoryHeatmapRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          toStartOfWeek(completed_at) AS week,
          category,
          countIf(severity = 'critical') AS critical,
          countIf(severity = 'warning') AS warning
        FROM seo_insight_events
        WHERE event_type = 'finding'
          AND completed_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY week, category
        ORDER BY week ASC, category ASC
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      week: string;
      category: string;
      critical: string;
      warning: string;
    }[];

    return rows.map((row) => ({
      week: row.week,
      category: row.category,
      critical: Number(row.critical ?? 0),
      warning: Number(row.warning ?? 0),
    }));
  } catch (error) {
    console.error('[clickhouse] category heatmap failed:', error);
    return [];
  }
}

/** Run showcase queries and return timings — proves sub-second aggregations at scale. */
export async function getShowcaseQueryTimings(): Promise<QueryTiming[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  const queries: Array<{ name: string; query: string; params?: Record<string, unknown> }> = [
    {
      name: 'conversion_countIf_30d',
      query: `SELECT countIf(event_type = 'page_view') AS v, countIf(event_type = 'cta_click') AS c
        FROM analytics_events WHERE created_at >= now() - INTERVAL 30 DAY`,
    },
    {
      name: 'hourly_funnel_7d',
      query: `SELECT toStartOfHour(created_at) AS h, countIf(event_type = 'page_view') AS v
        FROM analytics_events WHERE created_at >= now() - INTERVAL 7 DAY GROUP BY h`,
    },
    {
      name: 'persistent_findings_90d',
      query: `SELECT title, dateDiff('day', min(completed_at), max(completed_at)) AS days
        FROM seo_insight_events WHERE event_type = 'finding'
        GROUP BY title, category, severity HAVING count(DISTINCT audit_id) >= 2 LIMIT 20`,
    },
    {
      name: 'hourly_mv_7d',
      query: `SELECT hour, sum(event_count) AS c FROM analytics_hourly_agg
        WHERE hour >= now() - INTERVAL 7 DAY GROUP BY hour`,
    },
  ];

  const timings: QueryTiming[] = [];
  for (const q of queries) {
    try {
      const { timing } = await timedQuery(q.name, q.query, q.params);
      timings.push(timing);
    } catch {
      timings.push({ name: q.name, elapsedMs: -1, rowCount: 0 });
    }
  }
  return timings;
}
