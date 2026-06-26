import { getConversionMetrics, getHourlyFunnel } from '@/lib/clickhouse/events';
import {
  getCategoryHeatmap,
  getDailyConversionTrend,
  getRankTrajectory,
  getShowcaseQueryTimings,
  type CategoryHeatmapRow,
  type DailyConversionRow,
  type QueryTiming,
  type RankTrajectoryRow,
} from '@/lib/clickhouse/analytics-deep';
import { getAgentLoopTimeline, type AgentLoopRow } from '@/lib/clickhouse/agent-loop';
import { getLlmEvalAggregates, type EvalAggregateRow } from '@/lib/clickhouse/evals';
import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';
import {
  getPersistentFindings,
  getSeoPromptContext,
  type PersistentFinding,
  type SeoPromptContext,
} from '@/lib/clickhouse/seo-insights';
import { hasLangfuseConfig } from '@/lib/langfuse/client';

export type { PersistentFinding };

export interface ClickHouseScaleStats {
  analyticsEventCount: number;
  seoInsightEventCount: number;
  agentLoopEventCount: number;
  llmEvalEventCount: number;
  hourlyAggRows: number;
  distinctAudits: number;
  distinctLeads: number;
}

export interface ClickHouseShowcase {
  source: 'clickhouse' | 'none';
  architecture: {
    sensory: string;
    cognitive: string;
    motor: string;
    evals: string;
  };
  scale: ClickHouseScaleStats;
  conversion: {
    pageViews: number;
    ctaClicks: number;
    conversionRate: number | null;
    hourlyBuckets: number;
    dailyTrend: DailyConversionRow[];
  };
  seo: {
    persistentFindings: PersistentFinding[];
    rankTrajectory: RankTrajectoryRow[];
    categoryHeatmap: CategoryHeatmapRow[];
  };
  agentLoop: AgentLoopRow[];
  langfuse: {
    configured: boolean;
    evalAggregates: EvalAggregateRow[];
  };
  queryTimings: QueryTiming[];
  promptPreview: Pick<
    SeoPromptContext,
    'trendSummary' | 'promptBlock' | 'auditCount' | 'recurringFindings'
  >;
  exampleQueries: Array<{ name: string; sql: string; purpose: string }>;
  postgresPainPoints: string[];
}

export async function getClickHouseScaleStats(): Promise<ClickHouseScaleStats | null> {
  const client = getClickHouseClient();
  if (!client) return null;

  const ready = await ensureClickHouseSchema();
  if (!ready) return null;

  try {
    const result = await client.query({
      query: `
        SELECT
          (SELECT count() FROM analytics_events) AS analytics_events,
          (SELECT count() FROM seo_insight_events) AS seo_events,
          (SELECT count() FROM agent_loop_events) AS agent_loops,
          (SELECT count() FROM llm_eval_events) AS llm_evals,
          (SELECT count() FROM analytics_hourly_agg) AS hourly_agg,
          (SELECT count(DISTINCT audit_id) FROM seo_insight_events WHERE event_type = 'audit_summary') AS audits,
          (SELECT count(DISTINCT lead_id) FROM seo_insight_events WHERE lead_id IS NOT NULL) AS leads
      `,
      format: 'JSONEachRow',
    });

    const row = ((await result.json()) as Record<string, string>[])[0];
    if (!row) return null;

    return {
      analyticsEventCount: Number(row.analytics_events ?? 0),
      seoInsightEventCount: Number(row.seo_events ?? 0),
      agentLoopEventCount: Number(row.agent_loops ?? 0),
      llmEvalEventCount: Number(row.llm_evals ?? 0),
      hourlyAggRows: Number(row.hourly_agg ?? 0),
      distinctAudits: Number(row.audits ?? 0),
      distinctLeads: Number(row.leads ?? 0),
    };
  } catch (error) {
    console.error('[clickhouse] scale stats query failed:', error);
    return null;
  }
}

const EXAMPLE_QUERIES = [
  {
    name: 'Hourly conversion funnel',
    purpose: 'GROUP BY hour over 7 days — expensive sort + scan in Postgres at scale',
    sql: `SELECT toStartOfHour(created_at) AS hour,
  countIf(event_type = 'page_view') AS views,
  countIf(event_type = 'cta_click') AS clicks
FROM analytics_events
WHERE created_at >= now() - INTERVAL 7 DAY
GROUP BY hour ORDER BY hour`,
  },
  {
    name: 'Issues persisting N days',
    purpose: 'dateDiff(min, max) per finding — correlated subqueries in Postgres',
    sql: `SELECT title, severity,
  dateDiff('day', min(completed_at), max(completed_at)) AS days_persisting,
  count(DISTINCT audit_id) AS audits
FROM seo_insight_events
WHERE event_type = 'finding'
GROUP BY title, category, severity
HAVING audits >= 2
ORDER BY days_persisting DESC`,
  },
  {
    name: 'Materialized hourly rollup',
    purpose: 'Pre-aggregated SummingMergeTree — O(buckets) reads for CRO cron',
    sql: `SELECT hour, event_type, sum(event_count) AS events
FROM analytics_hourly_agg
WHERE hour >= now() - INTERVAL 7 DAY
GROUP BY hour, event_type
ORDER BY hour`,
  },
  {
    name: 'Rank + LCP trajectory',
    purpose: 'Time-series audit snapshots for a lead — row explosion in Postgres JSON',
    sql: `SELECT completed_at, rank_position, lcp_ms, critical_count
FROM seo_insight_events
WHERE event_type = 'audit_summary' AND lead_id = {leadId:UUID}
ORDER BY completed_at ASC`,
  },
];

const POSTGRES_PAIN = [
  'Full-table scan for countIf conversion over 30 days of raw events',
  'Hourly GROUP BY requires sort + aggregate on every cron tick',
  'Cross-audit dateDiff for “issues persisting 14 days” needs self-joins per finding title',
  'Category heatmap by week = multiple passes or window functions on JSON findings',
  'Agent loop timeline mixing optimize + audit events across heterogeneous tables',
];

export async function getClickHouseShowcase(): Promise<ClickHouseShowcase | null> {
  const scale = await getClickHouseScaleStats();
  if (!scale) return null;

  const [
    conversion,
    hourly,
    persistentFindings,
    promptContext,
    dailyTrend,
    rankTrajectory,
    categoryHeatmap,
    agentLoop,
    queryTimings,
    evalAggregates,
  ] = await Promise.all([
    getConversionMetrics(30),
    getHourlyFunnel(7),
    getPersistentFindings(90),
    getSeoPromptContext({ days: 90 }),
    getDailyConversionTrend(30),
    getRankTrajectory({ days: 90 }),
    getCategoryHeatmap(90),
    getAgentLoopTimeline(15),
    getShowcaseQueryTimings(),
    getLlmEvalAggregates(30),
  ]);

  return {
    source: 'clickhouse',
    architecture: {
      sensory: 'analytics_events + analytics_hourly_mv → conversion metrics for CRO agent',
      cognitive: 'seo_insight_events → persistent findings, rank/LCP trajectory, prompt memory',
      motor: 'agent_loop_events → closed-loop log of optimize + audit ingests',
      evals: 'Langfuse traces + scores on every LLM run; mirrored to llm_eval_events in ClickHouse',
    },
    scale,
    conversion: {
      pageViews: conversion?.pageViews ?? 0,
      ctaClicks: conversion?.ctaClicks ?? 0,
      conversionRate: conversion?.conversionRate ?? null,
      hourlyBuckets: hourly.length,
      dailyTrend,
    },
    seo: {
      persistentFindings,
      rankTrajectory,
      categoryHeatmap,
    },
    agentLoop,
    langfuse: {
      configured: hasLangfuseConfig(),
      evalAggregates,
    },
    queryTimings,
    promptPreview: {
      trendSummary: promptContext.trendSummary,
      promptBlock: promptContext.promptBlock,
      auditCount: promptContext.auditCount,
      recurringFindings: promptContext.recurringFindings,
    },
    exampleQueries: EXAMPLE_QUERIES,
    postgresPainPoints: POSTGRES_PAIN,
  };
}
