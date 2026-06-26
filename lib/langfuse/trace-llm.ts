import { flushLangfuse, getLangfuseClient, hasLangfuseConfig } from '@/lib/langfuse/client';
import { recordLlmEvalInClickHouse } from '@/lib/clickhouse/evals';
import {
  computeResearchEvalScores,
  runResearchQualityJudge,
  type ResearchEvalInput,
} from '@/lib/langfuse/research-eval';
import { researchSessionId } from '@/lib/langfuse/session';
import type { AuditFinding, ToolTraceEntry } from '@/lib/research/types';

export interface TraceOptimizeParams {
  leadId?: string;
  decision: {
    thought_process: string;
    action_taken: string;
    updates: Record<string, string | undefined>;
  };
  metrics: {
    viewCount: number;
    clickCount: number;
    conversionRate: string;
    seoContextUsed: boolean;
  };
}

function countCopyChanges(updates: Record<string, string | undefined>): number {
  return Object.values(updates).filter((v) => typeof v === 'string' && v.trim().length > 0).length;
}

/** Business eval scores (LLM calls traced via OTEL in lib/llm/generate.ts). */
export async function traceOptimizeRun(params: TraceOptimizeParams): Promise<void> {
  const conversionRateNum = Number.parseFloat(params.metrics.conversionRate) || 0;
  const copyChanges = countCopyChanges(params.decision.updates);

  const scores = [
    {
      name: 'conversion_rate',
      value: conversionRateNum,
      comment: `${params.metrics.clickCount}/${params.metrics.viewCount} CTA clicks`,
    },
    {
      name: 'seo_context_used',
      value: params.metrics.seoContextUsed ? 1 : 0,
    },
    {
      name: 'copy_fields_updated',
      value: copyChanges,
    },
    {
      name: 'below_target_cvr',
      value: conversionRateNum < 10 ? 1 : 0,
      comment: 'CRO agent triggers rewrite when CVR < 10%',
    },
  ];

  const metadata = {
    viewCount: params.metrics.viewCount,
    clickCount: params.metrics.clickCount,
    leadId: params.leadId ?? null,
  };

  if (hasLangfuseConfig()) {
    try {
      const lf = getLangfuseClient()!;
      const trace = lf.trace({
        name: 'synapsecro.optimize.eval',
        sessionId: params.leadId ?? 'global',
        userId: params.leadId,
        tags: ['cro', 'optimize', 'eval'],
        metadata,
      });

      for (const score of scores) {
        trace.score({
          name: score.name,
          value: score.value,
          comment: score.comment,
        });
      }

      await flushLangfuse();
    } catch (error) {
      console.error('[langfuse] optimize eval scores failed:', error);
    }
  }

  await recordLlmEvalInClickHouse({
    traceName: 'synapsecro.optimize',
    observationName: 'cro-optimizer',
    leadId: params.leadId ?? null,
    scores,
    metadata,
    outputPreview: JSON.stringify(params.decision),
  });
}

export interface TraceResearchParams {
  auditId?: string;
  leadId?: string | null;
  businessName: string;
  keyword: string;
  targetUrl?: string | null;
  findings: AuditFinding[];
  summary?: string | null;
  recommendations?: string | null;
  toolTrace?: ToolTraceEntry[];
  rankPosition?: number | null;
  lcpMs?: number | null;
  competitorCount?: number | null;
}

export async function traceResearchAudit(params: TraceResearchParams): Promise<void> {
  const evalInput: ResearchEvalInput = {
    findings: params.findings,
    summary: params.summary ?? null,
    recommendations: params.recommendations ?? null,
    toolTrace: params.toolTrace ?? [],
    rankPosition: params.rankPosition,
    lcpMs: params.lcpMs,
    competitorCount: params.competitorCount,
  };

  // Deterministic signals are free; the LLM judge runs in parallel and degrades
  // gracefully to [] when disabled or on error.
  const sessionId = researchSessionId({ leadId: params.leadId, targetUrl: params.targetUrl });

  const [deterministic, judged] = await Promise.all([
    Promise.resolve(computeResearchEvalScores(evalInput)),
    runResearchQualityJudge(evalInput, sessionId),
  ]);
  const scores = [...deterministic, ...judged];
  const metadata = {
    businessName: params.businessName,
    keyword: params.keyword,
    targetUrl: params.targetUrl ?? null,
    auditId: params.auditId ?? null,
    judgeApplied: judged.length > 0,
  };

  if (hasLangfuseConfig()) {
    try {
      const lf = getLangfuseClient()!;
      const trace = lf.trace({
        name: 'synapsecro.research_audit.eval',
        sessionId,
        userId: params.leadId ?? undefined,
        tags: ['research', 'audit', 'eval'],
        metadata,
      });
      for (const score of scores) {
        trace.score({ name: score.name, value: score.value, comment: score.comment });
      }
      await flushLangfuse();
    } catch (error) {
      console.error('[langfuse] research eval scores failed:', error);
    }
  }

  await recordLlmEvalInClickHouse({
    traceName: 'synapsecro.research_audit',
    leadId: params.leadId ?? null,
    auditId: params.auditId ?? null,
    scores,
    metadata,
  });
}
