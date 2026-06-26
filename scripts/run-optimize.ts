/**
 * Run the CRO optimize loop locally (same path as POST /api/optimize).
 *
 * Usage:
 *   npx tsx scripts/run-optimize.ts
 *   npx tsx scripts/run-optimize.ts --leadId UUID
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { propagateAttributes } from '@langfuse/tracing';
import { getConversionMetricsForOptimize } from '../lib/analytics/metrics';
import { recordAgentLoopEvent } from '../lib/clickhouse/agent-loop';
import { hasLangfuseConfig } from '../lib/langfuse/client';
import { flushLangfuseSpans } from '../lib/langfuse/otel';
import { traceOptimizeRun } from '../lib/langfuse/trace-llm';
import { buildOptimizePrompt } from '../lib/llm/optimize-prompt';
import { runOptimizationLLM } from '../lib/llm/providers';
import { fetchSeoPromptContext } from '../lib/seo/prompt-context';
import { getSupabaseAdmin } from '../lib/supabase/admin';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseLeadId(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--leadId' && argv[i + 1]) return argv[++i];
  }
  return undefined;
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '..');
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, '.env.local'));

  const leadId = parseLeadId(process.argv.slice(2));
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase not configured');

  console.log('Running CRO optimize…', leadId ? `(leadId=${leadId})` : '(global)');
  const start = Date.now();

  const { viewCount, clickCount, conversionRate } = await getConversionMetricsForOptimize();
  console.log(`Metrics: ${clickCount}/${viewCount} CTA (${conversionRate}% CVR)`);

  const { data: currentCopy } = await supabase.from('site_copy').select('*');
  const seoContext = leadId ? await fetchSeoPromptContext({ leadId }) : null;
  if (seoContext) console.log('SEO context from ClickHouse: yes');

  const prompt = buildOptimizePrompt({
    viewCount,
    clickCount,
    conversionRate,
    currentCopy,
    seoContext: seoContext ?? undefined,
  });

  const runLlm = () => runOptimizationLLM(prompt);
  const decision =
    hasLangfuseConfig()
      ? await propagateAttributes(
          {
            traceName: 'synapsecro.optimize',
            sessionId: leadId ?? 'global',
            userId: leadId,
            tags: ['cro', 'optimize', 'hackathon'],
          },
          runLlm,
        )
      : await runLlm();

  for (const [key, val] of Object.entries(decision.updates)) {
    if (typeof val !== 'string') continue;
    await supabase
      .from('site_copy')
      .update({ text_content: val, updated_at: new Date().toISOString() })
      .eq('id', key);
  }

  await supabase.from('agent_brain_logs').insert({
    thought_process: decision.thought_process,
    action_taken: decision.action_taken,
  });

  void recordAgentLoopEvent({
    loopType: 'optimize',
    leadId: leadId ?? null,
    payload: {
      thoughtProcess: decision.thought_process,
      actionTaken: decision.action_taken,
      updates: decision.updates,
    },
    metricsSnapshot: {
      viewCount,
      clickCount,
      conversionRate,
      seoContextUsed: Boolean(seoContext),
    },
  });

  await traceOptimizeRun({
    leadId,
    decision,
    metrics: {
      viewCount,
      clickCount,
      conversionRate,
      seoContextUsed: Boolean(seoContext),
    },
  });

  await flushLangfuseSpans();

  console.log('\n--- Optimize result ---');
  console.log('Action:', decision.action_taken);
  console.log('Thought:', decision.thought_process.slice(0, 200) + '…');
  console.log('Updates:', Object.keys(decision.updates).filter((k) => decision.updates[k]));
  console.log(`\nCompleted in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
