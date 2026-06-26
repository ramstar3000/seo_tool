import { estimateLlmUsageUsd, estimateOperationUsd } from '@/lib/cost/pricing';
import {
  getGlobalSpendCapUsd,
  getLlmSpendCapUsd,
  getProviderSpendCapUsd,
  isNearCap,
} from '@/lib/cost/limits';
import type {
  ApiProvider,
  CostSummary,
  ProviderSpendSummary,
  RecordApiUsageParams,
} from '@/lib/cost/types';
import { API_PROVIDERS } from '@/lib/cost/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const LLM_PROVIDERS: ApiProvider[] = ['gemini', 'anthropic'];

interface UsageRow {
  provider: string;
  estimated_usd: number | string;
  created_at: string;
}

function roundUsd(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || Boolean(error.message?.includes('Could not find the table'));
}

async function fetchUsageRows(since?: Date): Promise<UsageRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase.from('api_usage_events').select('provider, estimated_usd, created_at');

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[cost] api_usage_events table missing; spend tracking degraded');
      return [];
    }
    console.error('[cost] failed to read usage:', error.message);
    return [];
  }

  return (data ?? []) as UsageRow[];
}

/** Legacy llm_usage_events rows (pre-unified tracking). */
async function fetchLegacyLlmRows(): Promise<UsageRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('llm_usage_events')
    .select('provider, estimated_usd, created_at');

  if (error) {
    if (isMissingTableError(error)) return [];
    console.error('[cost] failed to read legacy llm usage:', error.message);
    return [];
  }

  return (data ?? []) as UsageRow[];
}

function sumRows(rows: UsageRow[], provider?: ApiProvider): number {
  const filtered = provider ? rows.filter((r) => r.provider === provider) : rows;
  return roundUsd(filtered.reduce((sum, row) => sum + Number(row.estimated_usd ?? 0), 0));
}

export async function recordApiUsage(params: RecordApiUsageParams): Promise<void> {
  const units = params.units ?? 1;
  const inputTokens = params.inputTokens ?? 0;
  const outputTokens = params.outputTokens ?? 0;

  let estimatedUsd = params.estimatedUsd;
  if (estimatedUsd === undefined) {
    if (params.provider === 'gemini' || params.provider === 'anthropic') {
      estimatedUsd = estimateLlmUsageUsd({
        provider: params.provider,
        inputTokens,
        outputTokens,
      });
    } else {
      estimatedUsd = estimateOperationUsd(params.provider, params.operation, units);
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn('[cost] Supabase not configured; usage not persisted');
    return;
  }

  const { error } = await supabase.from('api_usage_events').insert({
    provider: params.provider,
    operation: params.operation,
    units,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_usd: estimatedUsd,
    metadata: params.metadata ?? {},
  });

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[cost] api_usage_events table missing; usage not persisted');
      return;
    }
    console.error('[cost] failed to record usage:', error.message);
  }
}

export async function getProviderSpendUsd(provider: ApiProvider): Promise<number> {
  const [rows, legacy] = await Promise.all([fetchUsageRows(), fetchLegacyLlmRows()]);
  const allRows = [...rows, ...legacy];
  return sumRows(allRows, provider);
}

export async function getLlmSpendUsd(): Promise<number> {
  const [rows, legacy] = await Promise.all([fetchUsageRows(), fetchLegacyLlmRows()]);
  const allRows = [...rows, ...legacy];
  return roundUsd(
    allRows
      .filter((r) => LLM_PROVIDERS.includes(r.provider as ApiProvider))
      .reduce((sum, row) => sum + Number(row.estimated_usd ?? 0), 0)
  );
}

export async function getGlobalSpendUsd(): Promise<number> {
  const [rows, legacy] = await Promise.all([fetchUsageRows(), fetchLegacyLlmRows()]);
  return sumRows([...rows, ...legacy]);
}

function buildProviderSummary(
  provider: ApiProvider,
  allRows: UsageRow[],
  last7Rows: UsageRow[]
): ProviderSpendSummary {
  const spentUsd = sumRows(allRows, provider);
  const last7DaysUsd = sumRows(last7Rows, provider);
  const capUsd =
    provider === 'gemini' || provider === 'anthropic'
      ? getLlmSpendCapUsd()
      : getProviderSpendCapUsd(provider);
  const callCount = allRows.filter((r) => r.provider === provider).length;
  const capped = capUsd !== null && spentUsd >= capUsd;

  return {
    provider,
    spentUsd,
    capUsd,
    capped,
    warning: isNearCap(spentUsd, capUsd),
    last7DaysUsd,
    callCount,
  };
}

export async function getCostSummary(): Promise<CostSummary> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [allRows, last7Rows, legacy] = await Promise.all([
    fetchUsageRows(),
    fetchUsageRows(since),
    fetchLegacyLlmRows(),
  ]);

  const mergedAll = [...allRows, ...legacy];
  const merged7d = [...last7Rows, ...legacy.filter((r) => new Date(r.created_at) >= since)];

  const totalSpendUsd = sumRows(mergedAll);
  const last7DaysUsd = sumRows(merged7d);
  const globalCapUsd = getGlobalSpendCapUsd();
  const llmSpendUsd = roundUsd(
    mergedAll
      .filter((r) => LLM_PROVIDERS.includes(r.provider as ApiProvider))
      .reduce((sum, row) => sum + Number(row.estimated_usd ?? 0), 0)
  );
  const llmCapUsd = getLlmSpendCapUsd();

  const providers = API_PROVIDERS.map((provider) =>
    buildProviderSummary(provider, mergedAll, merged7d)
  );

  return {
    totalSpendUsd,
    globalCapUsd,
    globalCapped: globalCapUsd !== null && totalSpendUsd >= globalCapUsd,
    globalWarning: isNearCap(totalSpendUsd, globalCapUsd),
    llmSpendUsd,
    llmCapUsd,
    llmCapped: llmSpendUsd >= llmCapUsd,
    providers,
    last7DaysUsd,
  };
}
