import { tool, type ToolSet } from 'ai';
import type { z } from 'zod';
import {
  checkPageSpeedInputSchema,
  checkSerpAdsInputSchema,
  checkSocialPresenceInputSchema,
  compareMessagingInputSchema,
  discoverSiblingPagesInputSchema,
  finalizeAuditInputSchema,
  findCompetitorsInputSchema,
  saveFindingInputSchema,
  scrapePageSeoInputSchema,
} from '@/lib/research/schemas';
import { runToolWithTrace } from '@/lib/research/tools';
import type { ToolContext, ToolTraceEntry } from '@/lib/research/types';

function wrapTool(
  name: string,
  description: string,
  inputSchema: z.ZodType,
  ctx: ToolContext,
  toolTrace: ToolTraceEntry[],
  getTurn: () => number
) {
  return tool({
    description,
    inputSchema,
    execute: async (input) => {
      const { result, trace } = await runToolWithTrace(getTurn(), name, input, ctx);
      toolTrace.push(trace);
      return result;
    },
  });
}

export function createResearchAgentTools(
  ctx: ToolContext,
  toolTrace: ToolTraceEntry[],
  getTurn: () => number
): ToolSet {
  return {
    find_competitors: wrapTool(
      'find_competitors',
      'Find top organic competitors for a keyword in a given location (via Tavily web search).',
      findCompetitorsInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    scrape_page_seo: wrapTool(
      'scrape_page_seo',
      'Fetch a page and extract SEO signals (title, meta, headings, CTAs, etc.).',
      scrapePageSeoInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    discover_sibling_pages: wrapTool(
      'discover_sibling_pages',
      'Discover internal pages from sitemap and homepage links.',
      discoverSiblingPagesInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    compare_messaging: wrapTool(
      'compare_messaging',
      'Compare messaging consistency across scraped pages (H1, meta, CTAs).',
      compareMessagingInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    check_serp_ads: wrapTool(
      'check_serp_ads',
      'Check paid ad landscape for a keyword (limited — Tavily has no ad API).',
      checkSerpAdsInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    check_social_presence: wrapTool(
      'check_social_presence',
      'Discover social & directory profiles and compare messaging vs the website.',
      checkSocialPresenceInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    check_page_speed: wrapTool(
      'check_page_speed',
      'Fetch Core Web Vitals / PageSpeed Insights for a URL.',
      checkPageSpeedInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    save_finding: wrapTool(
      'save_finding',
      'Save an audit finding with severity, category, title, and description.',
      saveFindingInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
    finalize_audit: wrapTool(
      'finalize_audit',
      'Finalize the audit with an executive summary and recommendations. Ends the agent loop.',
      finalizeAuditInputSchema,
      ctx,
      toolTrace,
      getTurn
    ),
  } as ToolSet;
}

/** Direct tool execution for offline paths. */
export { executeTool } from '@/lib/research/tools';
