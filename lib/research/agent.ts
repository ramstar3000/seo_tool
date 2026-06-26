import { propagateAttributes } from '@langfuse/tracing';
import { getResearchModel, isResearchLlmConfigured } from '@/lib/llm/client';
import { researchSessionId } from '@/lib/langfuse/session';
import { LlmSpendCapExceededError, runLlmAgentGenerateText, runLlmObject } from '@/lib/llm/generate';
import { createResearchAgentTools } from '@/lib/research/agent-tools';
import { runOfflineResearchAudit } from '@/lib/research/offline-audit';
import {
  buildFindingsSynthesisUserPrompt,
  FINDINGS_SYNTHESIS_SYSTEM_PROMPT,
} from '@/lib/prompts/findings-synthesis';
import {
  buildResearchAgentUserTask,
  RESEARCH_AGENT_SYSTEM_PROMPT,
} from '@/lib/prompts/research-agent';
import { fetchSeoPromptContext } from '@/lib/seo/prompt-context';
import { auditReportSchema } from '@/lib/research/schemas';
import { MAX_AGENT_TURNS, MAX_PAGE_SCRAPES } from '@/lib/research/tools';
import type {
  AuditPage,
  ResearchAgentResult,
  ToolContext,
  ToolTraceEntry,
} from '@/lib/research/types';
import type { RunResearchAgentParams } from '@/lib/research/offline-audit';

export type { RunResearchAgentParams };

function buildPagesFromContext(ctx: ToolContext, targetUrl: string): AuditPage[] {
  const pages: AuditPage[] = [];
  const now = new Date().toISOString();

  for (const [url, seo] of ctx.pages) {
    pages.push({
      url,
      is_target: url === targetUrl || url.replace(/\/$/, '') === targetUrl.replace(/\/$/, ''),
      page_type: url === targetUrl ? 'homepage' : 'internal',
      seo_json: seo,
      scraped_at: now,
    });
  }

  return pages;
}

/**
 * Load historical SEO insights for this business from ClickHouse so the audit
 * runs "warm" (aware of prior/persistent findings). Never fail the audit if the
 * memory store is unavailable — degrade to a cold run.
 */
async function loadAuditMemory(params: {
  leadId?: string;
  keyword?: string;
}): Promise<string | null> {
  try {
    return await fetchSeoPromptContext(params);
  } catch {
    return null;
  }
}

async function synthesizeFinalReport(
  ctx: ToolContext,
  priorInsights: string | null
): Promise<{ summary: string; recommendations: string }> {
  if (ctx.summary && ctx.recommendations) {
    try {
      const object = await runLlmObject({
        schema: auditReportSchema,
        system: FINDINGS_SYNTHESIS_SYSTEM_PROMPT,
        prompt: buildFindingsSynthesisUserPrompt({
          businessName: ctx.businessName,
          targetUrl: ctx.targetUrl,
          keyword: ctx.keyword,
          findings: ctx.findings,
          agentSummary: ctx.summary,
          agentRecommendations: ctx.recommendations,
          priorInsights,
        }),
        telemetry: { functionId: 'findings-synthesis' },
      });

      return object;
    } catch {
      return { summary: ctx.summary, recommendations: ctx.recommendations };
    }
  }

  return {
    summary: ctx.summary ?? 'Audit completed with limited data.',
    recommendations: ctx.recommendations ?? 'Review findings and prioritize SEO and messaging fixes.',
  };
}

export async function runResearchAgent(params: RunResearchAgentParams): Promise<ResearchAgentResult> {
  if (!isResearchLlmConfigured()) {
    return runOfflineResearchAudit(params);
  }

  try {
    return await runResearchAgentWithLlm(params);
  } catch (error) {
    if (error instanceof LlmSpendCapExceededError) {
      return runOfflineResearchAudit(params);
    }
    throw error;
  }
}

async function runResearchAgentWithLlm(params: RunResearchAgentParams): Promise<ResearchAgentResult> {
  const { targetUrl, keyword, businessName, location = 'London', leadId } = params;

  const ctx: ToolContext = {
    targetUrl,
    keyword,
    businessName,
    location,
    findings: [],
    pages: new Map(),
    competitors: [],
    socialProfiles: [],
    socialInconsistencies: [],
    socialSearched: false,
    pageSpeed: null,
    scrapeCount: 0,
    maxScrapes: MAX_PAGE_SCRAPES,
    finalized: false,
    summary: null,
    recommendations: null,
  };

  const priorInsights = await loadAuditMemory({ leadId, keyword });

  const toolTrace: ToolTraceEntry[] = [];
  let currentTurn = 1;

  // Name + enrich the generation trace and share the eval's session key so the
  // agent run and its downstream quality scores are correlatable in Langfuse.
  const report = await propagateAttributes(
    {
      traceName: 'synapsecro.research_audit',
      sessionId: researchSessionId({ leadId, targetUrl }),
      tags: ['research', 'audit', 'agent'],
      metadata: {
        targetUrl,
        keyword,
        businessName,
        location,
        ...(leadId ? { leadId } : {}),
      },
    },
    async () => {
      await runLlmAgentGenerateText({
        model: getResearchModel(),
        system: RESEARCH_AGENT_SYSTEM_PROMPT,
        prompt: buildResearchAgentUserTask({ targetUrl, keyword, businessName, location, priorInsights }),
        tools: createResearchAgentTools(ctx, toolTrace, () => currentTurn),
        stopWhen: ({ steps }) => steps.length >= MAX_AGENT_TURNS || ctx.finalized,
        onStepStart: ({ stepNumber }) => {
          currentTurn = stepNumber;
        },
        telemetry: { functionId: 'research-agent' },
      });

      return synthesizeFinalReport(ctx, priorInsights);
    }
  );
  const now = new Date().toISOString();
  return {
    audit: {
      lead_id: leadId ?? null,
      target_url: targetUrl,
      keyword,
      business_name: businessName,
      status: 'completed',
      summary: report.summary,
      recommendations: report.recommendations,
      tool_trace: toolTrace,
      completed_at: now,
    },
    competitors: ctx.competitors,
    pages: buildPagesFromContext(ctx, targetUrl),
    findings: ctx.findings,
    socialProfiles: ctx.socialProfiles,
    toolTrace,
  };
}
