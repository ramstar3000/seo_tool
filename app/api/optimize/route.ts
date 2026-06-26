import { NextRequest, NextResponse } from 'next/server';
import { propagateAttributes } from '@langfuse/tracing';
import { isCronAuthorized } from '@/lib/auth/cron-auth';
import { requireUser } from '@/lib/auth/require-user';
import { getConversionMetricsForOptimize } from '@/lib/analytics/metrics';
import { recordAgentLoopEvent } from '@/lib/clickhouse/agent-loop';
import { hasLangfuseConfig } from '@/lib/langfuse/client';
import { flushLangfuseSpans } from '@/lib/langfuse/otel';
import { traceOptimizeRun } from '@/lib/langfuse/trace-llm';
import { buildOptimizePrompt } from '@/lib/llm/optimize-prompt';
import { runOptimizationLLM } from '@/lib/llm/providers';
import { fetchSeoPromptContext } from '@/lib/seo/prompt-context';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function runOptimization(leadId?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { viewCount, clickCount, conversionRate } = await getConversionMetricsForOptimize();

  const { data: currentCopy } = await supabase.from('site_copy').select('*');

  const seoContext = leadId ? await fetchSeoPromptContext({ leadId }) : null;

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
            tags: ['cro', 'optimize'],
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

  return { decision, seoContextUsed: Boolean(seoContext) };
}

function errorStatus(message: string): number {
  if (message.includes('not configured')) return 503;
  return 500;
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    const auth = await requireUser();
    if ('error' in auth) {
      return auth.error;
    }
  }

  try {
    const leadId = request.nextUrl.searchParams.get('leadId') ?? undefined;
    const { decision, seoContextUsed } = await runOptimization(leadId);
    return NextResponse.json({
      success: true,
      decision,
      seoContextUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Optimization failed';
    const clientMessage =
      message.includes('not configured') ||
      message.includes('Invalid optimization')
        ? message
        : 'Optimization failed';
    return NextResponse.json({ success: false, error: clientMessage }, { status: errorStatus(message) });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
