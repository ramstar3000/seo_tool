import { generateText } from 'ai';
import { getResearchModel, isResearchLlmConfigured } from '@/lib/llm/client';
import { runLlmObject } from '@/lib/llm/generate';
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

async function synthesizeFinalReport(ctx: ToolContext): Promise<{ summary: string; recommendations: string }> {
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
        }),
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

  const toolTrace: ToolTraceEntry[] = [];
  let currentTurn = 1;

  await generateText({
    model: getResearchModel(),
    system: RESEARCH_AGENT_SYSTEM_PROMPT,
    prompt: buildResearchAgentUserTask({ targetUrl, keyword, businessName, location }),
    tools: createResearchAgentTools(ctx, toolTrace, () => currentTurn),
    stopWhen: ({ steps }) => steps.length >= MAX_AGENT_TURNS || ctx.finalized,
    onStepStart: ({ stepNumber }) => {
      currentTurn = stepNumber;
    },
  });

  const report = await synthesizeFinalReport(ctx);
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
