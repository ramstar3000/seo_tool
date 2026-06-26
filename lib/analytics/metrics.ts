import {
  getAnalyticsMetrics,
  getConversionMetrics,
} from '@/lib/clickhouse/events';
import { getClickHouseClient, hasClickHouseConfig } from '@/lib/clickhouse/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { AnalyticsMetrics } from '@/lib/clickhouse/events';

function metricsFromSupabaseEvents(events: { event_type: string }[]): AnalyticsMetrics {
  const pageViews = events.filter((e) => e.event_type === 'page_view').length;
  const ctaClicks = events.filter((e) => e.event_type === 'cta_click').length;
  const conversionRate = pageViews > 0 ? Math.round((ctaClicks / pageViews) * 1000) / 10 : null;

  return {
    source: 'supabase',
    totals: { pageViews, ctaClicks, conversionRate },
    hourly: [],
  };
}

export async function getDashboardAnalyticsMetrics(): Promise<AnalyticsMetrics | null> {
  if (hasClickHouseConfig()) {
    const metrics = await getAnalyticsMetrics();
    if (metrics) return metrics;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.from('analytics_events').select('event_type');
  if (error) return null;

  return metricsFromSupabaseEvents(data ?? []);
}

/** Used by the CRO optimize agent — prefers ClickHouse aggregations. */
export async function getConversionMetricsForOptimize(): Promise<{
  viewCount: number;
  clickCount: number;
  conversionRate: string;
}> {
  const fromClickHouse = hasClickHouseConfig() ? await getConversionMetrics(30) : null;

  if (fromClickHouse) {
    const viewCount = fromClickHouse.pageViews || 1;
    const clickCount = fromClickHouse.ctaClicks;
    return {
      viewCount,
      clickCount,
      conversionRate: ((clickCount / viewCount) * 100).toFixed(1),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: events } = await supabase.from('analytics_events').select('event_type');
  const clickCount = events?.filter((e) => e.event_type === 'cta_click').length || 0;
  const viewCount = events?.filter((e) => e.event_type === 'page_view').length || 1;

  return {
    viewCount,
    clickCount,
    conversionRate: ((clickCount / viewCount) * 100).toFixed(1),
  };
}
