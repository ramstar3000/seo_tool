import type Anthropic from '@anthropic-ai/sdk';
import { fetchPageContent } from '@/lib/research/fetch-page';
import { comparePageMessaging } from '@/lib/research/messaging';
import { extractSeoSignals } from '@/lib/research/seo-extract';
import { discoverInternalPages } from '@/lib/research/sitemap';
import { findCompetitors, getSerpAds, parseBusinessName } from '@/lib/research/serp';
import { checkSocialPresence } from '@/lib/research/social-presence';
import { SOCIAL_REFERENCE_PLATFORMS } from '@/lib/research/social-platforms';
import {
  checkSerpAdsInputSchema,
  checkSocialPresenceInputSchema,
  compareMessagingInputSchema,
  discoverSiblingPagesInputSchema,
  finalizeAuditInputSchema,
  findCompetitorsInputSchema,
  saveFindingInputSchema,
  scrapePageSeoInputSchema,
} from '@/lib/research/schemas';
import type { ToolContext, ToolTraceEntry } from '@/lib/research/types';

export const MAX_AGENT_TURNS = 12;
export const MAX_PAGE_SCRAPES = 8;

const SOCIAL_REFERENCE_PLATFORM_SUMMARY = SOCIAL_REFERENCE_PLATFORMS.map((p) => ({
  id: p.id,
  name: p.name,
  seoNotes: p.seoNotes,
}));

export const ANTHROPIC_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'find_competitors',
    description: 'Find top 10 Google organic competitors for a keyword in a given location.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search keyword to analyze' },
        location: { type: 'string', description: 'Geographic location (default: London)' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'scrape_page_seo',
    description: 'Fetch a page and extract SEO signals (title, meta, headings, CTAs, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to scrape' },
        page_type: { type: 'string', description: 'Page type label e.g. homepage, service, about' },
        is_target: { type: 'boolean', description: 'Whether this is the primary target URL' },
      },
      required: ['url'],
    },
  },
  {
    name: 'discover_sibling_pages',
    description: 'Discover internal pages from sitemap and homepage links.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Root URL to discover pages from' },
        max_pages: { type: 'number', description: 'Maximum pages to return (default 8)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'compare_messaging',
    description: 'Compare messaging consistency across scraped pages (H1, meta, CTAs).',
    input_schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs to compare (must be already scraped)',
        },
      },
      required: ['urls'],
    },
  },
  {
    name: 'check_serp_ads',
    description: 'Get Google ad snippets for a keyword to compare ad copy vs on-site messaging.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Keyword to check ads for' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'check_social_presence',
    description:
      'Discover social & directory profiles (LinkedIn, Instagram, GBP, Yelp, etc.) and compare messaging consistency vs the website.',
    input_schema: {
      type: 'object',
      properties: {
        businessName: { type: 'string', description: 'Business name to search for (defaults to audit business)' },
        location: { type: 'string', description: 'Location for local profile search (defaults to London)' },
        websiteUrl: { type: 'string', description: 'Website URL to extract linked social profiles from' },
      },
    },
  },
  {
    name: 'save_finding',
    description: 'Save an audit finding with severity, category, title, and description.',
    input_schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
        category: {
          type: 'string',
          enum: ['seo', 'messaging', 'cro', 'technical', 'competitive', 'social'],
        },
        title: { type: 'string' },
        description: { type: 'string' },
        evidence: { type: 'object', description: 'Optional supporting evidence' },
      },
      required: ['severity', 'category', 'title', 'description'],
    },
  },
  {
    name: 'finalize_audit',
    description: 'Finalize the audit with an executive summary and recommendations. Ends the agent loop.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Executive summary of the audit' },
        recommendations: { type: 'string', description: 'Prioritized recommendations' },
      },
      required: ['summary', 'recommendations'],
    },
  },
];

function sanitizeToolError(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 300);
}

export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'find_competitors': {
      const parsed = findCompetitorsInputSchema.parse(input);
      const results = await findCompetitors(parsed.keyword, parsed.location ?? 'London');

      ctx.competitors = results.map((r) => ({
        rank_position: r.position,
        business_name: parseBusinessName(r.title),
        url: r.link,
        title: r.title,
        snippet: r.snippet,
      }));

      return {
        competitors: ctx.competitors,
        count: ctx.competitors.length,
        note: ctx.competitors.length === 0 ? 'SerpAPI key may not be configured' : undefined,
      };
    }

    case 'scrape_page_seo': {
      const parsed = scrapePageSeoInputSchema.parse(input);

      if (ctx.scrapeCount >= ctx.maxScrapes) {
        return {
          error: `Scrape limit reached (${ctx.maxScrapes} pages per audit)`,
          cached: ctx.pages.has(parsed.url) ? ctx.pages.get(parsed.url) : undefined,
        };
      }

      if (ctx.pages.has(parsed.url)) {
        return { cached: true, seo: ctx.pages.get(parsed.url) };
      }

      const { html, url } = await fetchPageContent(parsed.url);
      const seo = extractSeoSignals(html, url);
      ctx.pages.set(url, seo);
      ctx.scrapeCount += 1;

      return {
        seo,
        scrapeCount: ctx.scrapeCount,
        maxScrapes: ctx.maxScrapes,
        page_type: parsed.page_type ?? 'unknown',
        is_target: parsed.is_target ?? false,
      };
    }

    case 'discover_sibling_pages': {
      const parsed = discoverSiblingPagesInputSchema.parse(input);
      const urls = await discoverInternalPages(parsed.url, parsed.max_pages ?? 8);
      return { urls, count: urls.length };
    }

    case 'compare_messaging': {
      const parsed = compareMessagingInputSchema.parse(input);
      const pages = parsed.urls
        .map((url) => ctx.pages.get(url))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

      if (pages.length === 0) {
        return { error: 'No scraped pages found for the given URLs. Scrape them first.' };
      }

      const inconsistencies = await comparePageMessaging(pages);
      return { inconsistencies, pageCount: pages.length };
    }

    case 'check_serp_ads': {
      const parsed = checkSerpAdsInputSchema.parse(input);
      const ads = await getSerpAds(parsed.keyword);
      return {
        ads,
        count: ads.length,
        note: ads.length === 0 ? 'No ads found or SerpAPI key not configured' : undefined,
      };
    }

    case 'check_social_presence': {
      const parsed = checkSocialPresenceInputSchema.parse(input);
      const businessName = parsed.businessName ?? ctx.businessName;
      const location = parsed.location ?? ctx.location;
      const websiteUrl = parsed.websiteUrl ?? ctx.targetUrl;

      const targetPageSeo = ctx.pages.get(websiteUrl) ?? ctx.pages.get(ctx.targetUrl) ?? null;
      const result = await checkSocialPresence(businessName, location, websiteUrl, targetPageSeo);

      ctx.socialProfiles = result.profiles.map((p) => ({
        platform_id: p.platformId,
        profile_url: p.profileUrl,
        bio_text: p.bioText,
        seo_json: p.seoSignals,
        found_via: p.foundVia,
        status: p.status,
      }));
      ctx.socialInconsistencies = result.inconsistencies;
      ctx.socialSearched = result.searched;

      for (const issue of result.inconsistencies) {
        const severity =
          issue.type === 'phone_mismatch' || issue.type === 'business_name_mismatch'
            ? 'warning'
            : issue.type === 'missing_major_platforms'
              ? 'warning'
              : 'info';

        ctx.findings.push({
          severity,
          category: 'social',
          title: issue.type.replace(/_/g, ' '),
          description: issue.description,
          evidence: {
            platforms: issue.platforms,
            recommendation: issue.recommendation,
          },
        });
      }

      const foundCount = result.profiles.filter((p) => p.status === 'found').length;
      const missingCount = result.profiles.filter((p) => p.status === 'missing').length;

      return {
        searched: result.searched,
        foundCount,
        missingCount,
        notSearched: result.profiles.filter((p) => p.status === 'not_searched').length,
        profiles: result.profiles.map((p) => ({
          platform: p.platformName,
          platformId: p.platformId,
          status: p.status,
          profileUrl: p.profileUrl,
          searchUrl: p.searchUrl,
          bioText: p.bioText,
          foundVia: p.foundVia,
        })),
        inconsistencies: result.inconsistencies,
        note: result.searched
          ? undefined
          : 'SerpAPI key not configured — returning platform checklist with not_searched status',
        referencePlatforms: SOCIAL_REFERENCE_PLATFORM_SUMMARY,
      };
    }

    case 'save_finding': {
      const parsed = saveFindingInputSchema.parse(input);
      ctx.findings.push({
        severity: parsed.severity,
        category: parsed.category,
        title: parsed.title,
        description: parsed.description,
        evidence: parsed.evidence,
      });
      return { saved: true, totalFindings: ctx.findings.length };
    }

    case 'finalize_audit': {
      const parsed = finalizeAuditInputSchema.parse(input);
      ctx.finalized = true;
      ctx.summary = parsed.summary;
      ctx.recommendations = parsed.recommendations;
      return { finalized: true };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function runToolWithTrace(
  turn: number,
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<{ result: unknown; trace: ToolTraceEntry }> {
  const start = Date.now();

  try {
    const result = await executeTool(name, input, ctx);
    return {
      result,
      trace: {
        turn,
        toolName: name,
        input,
        output: result,
        durationMs: Date.now() - start,
      },
    };
  } catch (error) {
    const message = sanitizeToolError(error instanceof Error ? error.message : 'Tool execution failed');
    return {
      result: { error: message },
      trace: {
        turn,
        toolName: name,
        input,
        output: { error: message },
        durationMs: Date.now() - start,
        error: message,
      },
    };
  }
}
