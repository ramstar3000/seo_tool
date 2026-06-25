import type Anthropic from '@anthropic-ai/sdk';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getAnthropicClient, isAnthropicConfigured, RESEARCH_AGENT_MODEL } from '@/lib/anthropic/client';
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
import {
  ANTHROPIC_TOOL_DEFINITIONS,
  MAX_AGENT_TURNS,
  MAX_PAGE_SCRAPES,
  runToolWithTrace,
} from '@/lib/research/tools';
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
      const { object } = await generateObject({
        model: anthropic(RESEARCH_AGENT_MODEL),
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
  if (!isAnthropicConfigured()) {
    return runOfflineResearchAudit(params);
  }

  const { targetUrl, keyword, businessName, location = 'London', leadId } = params;
  const client = getAnthropicClient();

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
    scrapeCount: 0,
    maxScrapes: MAX_PAGE_SCRAPES,
    finalized: false,
    summary: null,
    recommendations: null,
  };

  const toolTrace: ToolTraceEntry[] = [];
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: buildResearchAgentUserTask({ targetUrl, keyword, businessName, location }),
    },
  ];

  for (let turn = 1; turn <= MAX_AGENT_TURNS; turn++) {
    const response = await client.messages.create({
      model: RESEARCH_AGENT_MODEL,
      max_tokens: 4096,
      system: RESEARCH_AGENT_SYSTEM_PROMPT,
      tools: ANTHROPIC_TOOL_DEFINITIONS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUses.length === 0) {
      if (response.stop_reason === 'end_turn' && !ctx.finalized) {
        // Nudge agent to finalize if it stopped without calling finalize_audit
        messages.push({
          role: 'user',
          content: 'Please call finalize_audit with your summary and recommendations to complete the audit.',
        });
        continue;
      }
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const { result, trace } = await runToolWithTrace(turn, toolUse.name, toolUse.input, ctx);
      toolTrace.push(trace);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });

    if (ctx.finalized) break;
  }

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
