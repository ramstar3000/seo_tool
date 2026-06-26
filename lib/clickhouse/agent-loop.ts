import { getClickHouseClient } from '@/lib/clickhouse/client';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';

export type AgentLoopType = 'optimize' | 'audit_ingest' | 'outreach_send';

export interface RecordAgentLoopParams {
  loopType: AgentLoopType;
  leadId?: string | null;
  auditId?: string | null;
  payload?: Record<string, unknown>;
  metricsSnapshot?: Record<string, unknown>;
}

export async function recordAgentLoopEvent(params: RecordAgentLoopParams): Promise<void> {
  const client = getClickHouseClient();
  if (!client) return;

  const ready = await ensureClickHouseSchema();
  if (!ready) return;

  try {
    await client.insert({
      table: 'agent_loop_events',
      values: [
        {
          loop_type: params.loopType,
          lead_id: params.leadId ?? null,
          audit_id: params.auditId ?? null,
          payload: JSON.stringify(params.payload ?? {}),
          metrics_snapshot: JSON.stringify(params.metricsSnapshot ?? {}),
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (error) {
    console.error('[clickhouse] agent loop event failed:', error);
  }
}

export interface AgentLoopRow {
  loopType: string;
  leadId: string | null;
  auditId: string | null;
  payload: Record<string, unknown>;
  metricsSnapshot: Record<string, unknown>;
  createdAt: string;
}

export async function getAgentLoopTimeline(limit = 20): Promise<AgentLoopRow[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT loop_type, lead_id, audit_id, payload, metrics_snapshot, created_at
        FROM agent_loop_events
        ORDER BY created_at DESC
        LIMIT {limit:UInt16}
      `,
      query_params: { limit },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      loop_type: string;
      lead_id: string | null;
      audit_id: string | null;
      payload: string;
      metrics_snapshot: string;
      created_at: string;
    }[];

    return rows.map((row) => ({
      loopType: row.loop_type,
      leadId: row.lead_id,
      auditId: row.audit_id,
      payload: safeJsonParse(row.payload),
      metricsSnapshot: safeJsonParse(row.metrics_snapshot),
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('[clickhouse] agent loop timeline failed:', error);
    return [];
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
