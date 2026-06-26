import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';

export interface RecordLlmEvalParams {
  traceName: string;
  observationName?: string;
  leadId?: string | null;
  auditId?: string | null;
  scores: Array<{ name: string; value: number; comment?: string }>;
  metadata?: Record<string, unknown>;
  inputPreview?: string;
  outputPreview?: string;
}

export async function recordLlmEvalInClickHouse(params: RecordLlmEvalParams): Promise<void> {
  const client = getClickHouseClient();
  if (!client) return;

  const ready = await ensureClickHouseSchema();
  if (!ready) return;

  try {
    await client.insert({
      table: 'llm_eval_events',
      values: [
        {
          trace_name: params.traceName,
          observation_name: params.observationName ?? '',
          lead_id: params.leadId ?? null,
          audit_id: params.auditId ?? null,
          scores_json: JSON.stringify(params.scores),
          metadata: JSON.stringify(params.metadata ?? {}),
          input_preview: (params.inputPreview ?? '').slice(0, 2000),
          output_preview: (params.outputPreview ?? '').slice(0, 2000),
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (error) {
    console.error('[clickhouse] llm eval record failed:', error);
  }
}

export interface EvalAggregateRow {
  traceName: string;
  scoreName: string;
  avgValue: number;
  count: number;
}

export async function getLlmEvalAggregates(days = 30): Promise<EvalAggregateRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          trace_name,
          JSONExtractString(score, 'name') AS score_name,
          avg(JSONExtractFloat(score, 'value')) AS avg_value,
          count() AS cnt
        FROM llm_eval_events
        ARRAY JOIN JSONExtractArrayRaw(scores_json) AS score
        WHERE created_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY trace_name, score_name
        ORDER BY trace_name, score_name
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      trace_name: string;
      score_name: string;
      avg_value: string;
      cnt: string;
    }[];

    return rows.map((row) => ({
      traceName: row.trace_name,
      scoreName: row.score_name,
      avgValue: Math.round(Number(row.avg_value ?? 0) * 1000) / 1000,
      count: Number(row.cnt ?? 0),
    }));
  } catch (error) {
    console.error('[clickhouse] llm eval aggregates failed:', error);
    return [];
  }
}
