import { getClickHouseClient } from '@/lib/clickhouse/client';

let schemaReady = false;

const DDL = [
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
];

export async function ensureClickHouseSchema(): Promise<boolean> {
  if (schemaReady) return true;

  const client = getClickHouseClient();
  if (!client) return false;

  try {
    for (const statement of DDL) {
      await client.command({ query: statement });
    }
    schemaReady = true;
    return true;
  } catch (error) {
    console.error('[clickhouse] schema init failed:', error);
    return false;
  }
}
