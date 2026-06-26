import { getClickHouseClient } from '@/lib/clickhouse/client';

let schemaReady = false;

const TABLE_DDL = [
  `
  CREATE TABLE IF NOT EXISTS analytics_events (
    event_id UUID DEFAULT generateUUIDv4(),
    event_type LowCardinality(String),
    path LowCardinality(String) DEFAULT '/',
    referrer String DEFAULT '',
    user_agent String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(created_at)
  ORDER BY (event_type, created_at)
  TTL toDateTime(created_at) + INTERVAL 365 DAY
  `,
  `
  CREATE TABLE IF NOT EXISTS api_usage_events (
    event_id UUID DEFAULT generateUUIDv4(),
    provider LowCardinality(String),
    operation LowCardinality(String),
    units Float64 DEFAULT 1,
    input_tokens UInt32 DEFAULT 0,
    output_tokens UInt32 DEFAULT 0,
    estimated_usd Float64 DEFAULT 0,
    metadata String DEFAULT '{}',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(created_at)
  ORDER BY (provider, created_at)
  TTL toDateTime(created_at) + INTERVAL 365 DAY
  `,
  `
  CREATE TABLE IF NOT EXISTS seo_insight_events (
    event_id UUID DEFAULT generateUUIDv4(),
    event_type LowCardinality(String),
    audit_id UUID,
    lead_id Nullable(UUID),
    business_name String DEFAULT '',
    keyword String DEFAULT '',
    target_url String DEFAULT '',
    rank_position Nullable(Int16),
    lcp_ms Nullable(UInt32),
    competitor_count Nullable(UInt16),
    severity LowCardinality(String) DEFAULT '',
    category LowCardinality(String) DEFAULT '',
    title String DEFAULT '',
    description String DEFAULT '',
    critical_count UInt16 DEFAULT 0,
    warning_count UInt16 DEFAULT 0,
    info_count UInt16 DEFAULT 0,
    finding_count UInt16 DEFAULT 0,
    summary_snippet String DEFAULT '',
    recommendations_snippet String DEFAULT '',
    completed_at DateTime64(3, 'UTC') DEFAULT now64(3)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(completed_at)
  ORDER BY (lead_id, audit_id, event_type, completed_at)
  TTL toDateTime(completed_at) + INTERVAL 365 DAY
  SETTINGS allow_nullable_key = 1
  `,
  `
  CREATE TABLE IF NOT EXISTS agent_loop_events (
    event_id UUID DEFAULT generateUUIDv4(),
    loop_type LowCardinality(String),
    lead_id Nullable(UUID),
    audit_id Nullable(UUID),
    payload String DEFAULT '{}',
    metrics_snapshot String DEFAULT '{}',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(created_at)
  ORDER BY (loop_type, created_at)
  TTL toDateTime(created_at) + INTERVAL 365 DAY
  SETTINGS allow_nullable_key = 1
  `,
  `
  CREATE TABLE IF NOT EXISTS analytics_hourly_agg (
    hour DateTime,
    event_type LowCardinality(String),
    event_count UInt64
  )
  ENGINE = SummingMergeTree()
  PARTITION BY toYYYYMM(hour)
  ORDER BY (hour, event_type)
  `,
  `
  CREATE TABLE IF NOT EXISTS llm_eval_events (
    event_id UUID DEFAULT generateUUIDv4(),
    trace_name LowCardinality(String),
    observation_name LowCardinality(String) DEFAULT '',
    lead_id Nullable(UUID),
    audit_id Nullable(UUID),
    scores_json String DEFAULT '[]',
    metadata String DEFAULT '{}',
    input_preview String DEFAULT '',
    output_preview String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
  )
  ENGINE = MergeTree()
  PARTITION BY toYYYYMM(created_at)
  ORDER BY (trace_name, created_at)
  TTL toDateTime(created_at) + INTERVAL 365 DAY
  SETTINGS allow_nullable_key = 1
  `,
];

const ALTER_DDL = [
  `ALTER TABLE seo_insight_events ADD COLUMN IF NOT EXISTS lcp_ms Nullable(UInt32)`,
  `ALTER TABLE seo_insight_events ADD COLUMN IF NOT EXISTS competitor_count Nullable(UInt16)`,
];

const MV_DDL = [
  `
  CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_mv
  TO analytics_hourly_agg
  AS SELECT
    toStartOfHour(created_at) AS hour,
    event_type,
    count() AS event_count
  FROM analytics_events
  GROUP BY hour, event_type
  `,
];

export async function ensureClickHouseSchema(): Promise<boolean> {
  if (schemaReady) return true;

  const client = getClickHouseClient();
  if (!client) return false;

  try {
    for (const statement of TABLE_DDL) {
      await client.command({ query: statement });
    }
    for (const statement of ALTER_DDL) {
      try {
        await client.command({ query: statement });
      } catch {
        // Column may already exist on fresh create
      }
    }
    for (const statement of MV_DDL) {
      await client.command({ query: statement });
    }
    schemaReady = true;
    return true;
  } catch (error) {
    console.error('[clickhouse] schema init failed:', error);
    return false;
  }
}
