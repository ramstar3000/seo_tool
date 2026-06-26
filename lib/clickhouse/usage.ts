import type { RecordApiUsageParams } from '@/lib/cost/types';
import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';

export async function recordApiUsageInClickHouse(params: RecordApiUsageParams & {
  estimatedUsd: number;
}): Promise<void> {
  const client = getClickHouseClient();
  if (!client) return;

  const ready = await ensureClickHouseSchema();
  if (!ready) return;

  try {
    await client.insert({
      table: 'api_usage_events',
      values: [
        {
          provider: params.provider,
          operation: params.operation,
          units: params.units ?? 1,
          input_tokens: params.inputTokens ?? 0,
          output_tokens: params.outputTokens ?? 0,
          estimated_usd: params.estimatedUsd,
          metadata: JSON.stringify(params.metadata ?? {}),
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (error) {
    console.error('[clickhouse] failed to record api usage:', error);
  }
}

export interface ProviderSpendRow {
  provider: string;
  spentUsd: number;
  callCount: number;
}

export async function getProviderSpendFromClickHouse(days = 7): Promise<ProviderSpendRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          provider,
          sum(estimated_usd) AS spent_usd,
          count() AS call_count
        FROM api_usage_events
        WHERE created_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY provider
        ORDER BY spent_usd DESC
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      provider: string;
      spent_usd: string;
      call_count: string;
    }[];

    return rows.map((row) => ({
      provider: row.provider,
      spentUsd: Math.round(Number(row.spent_usd ?? 0) * 1e4) / 1e4,
      callCount: Number(row.call_count ?? 0),
    }));
  } catch (error) {
    console.error('[clickhouse] failed to read provider spend:', error);
    return [];
  }
}
