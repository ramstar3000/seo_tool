#!/usr/bin/env node
/**
 * Initialize ClickHouse tables and optionally backfill from Supabase.
 *
 * Usage:
 *   node scripts/clickhouse-init.mjs
 *   node scripts/clickhouse-init.mjs --backfill
 */
import { createClient } from '@clickhouse/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { loadDotEnv } from './lib/load-dotenv.mjs';

loadDotEnv();

const url = process.env.CLICKHOUSE_URL?.trim();
const password = process.env.CLICKHOUSE_PASSWORD ?? '';
const user = process.env.CLICKHOUSE_USER?.trim() || 'default';
const database = process.env.CLICKHOUSE_DATABASE?.trim() || 'default';
const backfill = process.argv.includes('--backfill');

if (!url) {
  console.error('Set CLICKHOUSE_URL (CLICKHOUSE_PASSWORD optional for local Docker)');
  process.exit(1);
}

const ch = createClient({
  url,
  username: user,
  password,
  database,
  application: 'synapsecro-init',
});

const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS analytics_events (
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
  TTL toDateTime(created_at) + INTERVAL 365 DAY`,
  `CREATE TABLE IF NOT EXISTS api_usage_events (
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
  TTL toDateTime(created_at) + INTERVAL 365 DAY`,
  `CREATE TABLE IF NOT EXISTS seo_insight_events (
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
  SETTINGS allow_nullable_key = 1`,
  `CREATE TABLE IF NOT EXISTS agent_loop_events (
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
  SETTINGS allow_nullable_key = 1`,
  `CREATE TABLE IF NOT EXISTS analytics_hourly_agg (
    hour DateTime,
    event_type LowCardinality(String),
    event_count UInt64
  )
  ENGINE = SummingMergeTree()
  PARTITION BY toYYYYMM(hour)
  ORDER BY (hour, event_type)`,
  `CREATE TABLE IF NOT EXISTS llm_eval_events (
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
  SETTINGS allow_nullable_key = 1`,
];

const ALTER_DDL = [
  `ALTER TABLE seo_insight_events ADD COLUMN IF NOT EXISTS lcp_ms Nullable(UInt32)`,
  `ALTER TABLE seo_insight_events ADD COLUMN IF NOT EXISTS competitor_count Nullable(UInt16)`,
];

const MV_DDL = [
  `CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_mv
  TO analytics_hourly_agg
  AS SELECT
    toStartOfHour(created_at) AS hour,
    event_type,
    count() AS event_count
  FROM analytics_events
  GROUP BY hour, event_type`,
];

async function main() {
  console.log('Pinging ClickHouse…');
  const ping = await ch.ping();
  if (!ping.success) {
    throw new Error('ClickHouse ping failed');
  }

  for (const statement of TABLE_DDL) {
    await ch.command({ query: statement });
  }
  for (const statement of ALTER_DDL) {
    try {
      await ch.command({ query: statement });
    } catch {
      // column may already exist
    }
  }
  for (const statement of MV_DDL) {
    await ch.command({ query: statement });
  }

  console.log(
    'Tables ready: analytics_events, api_usage_events, seo_insight_events, agent_loop_events, llm_eval_events, analytics_hourly_agg (+ MV)',
  );

  if (!backfill) {
    await ch.close();
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Skipping backfill — Supabase credentials not set');
    await ch.close();
    return;
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data: analytics, error: analyticsError } = await supabase
    .from('analytics_events')
    .select('event_type, created_at');

  if (analyticsError) {
    console.warn('Analytics backfill skipped:', analyticsError.message);
  } else if (analytics?.length) {
    await ch.insert({
      table: 'analytics_events',
      values: analytics.map((row) => ({
        event_type: row.event_type,
        path: '/',
        referrer: '',
        user_agent: '',
        created_at: row.created_at,
      })),
      format: 'JSONEachRow',
    });
    console.log(`Backfilled ${analytics.length} analytics_events rows`);
  }

  const { data: usage, error: usageError } = await supabase
    .from('api_usage_events')
    .select('*');

  if (usageError) {
    console.warn('Usage backfill skipped:', usageError.message);
  } else if (usage?.length) {
    await ch.insert({
      table: 'api_usage_events',
      values: usage.map((row) => ({
        provider: row.provider,
        operation: row.operation,
        units: Number(row.units ?? 1),
        input_tokens: row.input_tokens ?? 0,
        output_tokens: row.output_tokens ?? 0,
        estimated_usd: Number(row.estimated_usd ?? 0),
        metadata: JSON.stringify(row.metadata ?? {}),
        created_at: row.created_at,
      })),
      format: 'JSONEachRow',
    });
    console.log(`Backfilled ${usage.length} api_usage_events rows`);
  }

  await ch.close();
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
