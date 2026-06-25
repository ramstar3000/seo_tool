import { fetchPageContent } from '@/lib/research/fetch-page';
import { comparePageMessaging } from '@/lib/research/messaging';
import { extractSeoSignals } from '@/lib/research/seo-extract';
import { checkSocialPresence } from '@/lib/research/social-presence';
import type {
  AuditCompetitor,
  AuditFinding,
  AuditPage,
  AuditSocialProfile,
  ResearchAgentResult,
  SeoSignals,
  ToolTraceEntry,
} from '@/lib/research/types';

export interface RunResearchAgentParams {
  targetUrl: string;
  keyword: string;
  businessName: string;
  location?: string;
  leadId?: string;
}

function buildSeoFindings(seo: SeoSignals, keyword: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!seo.title) {
    findings.push({
      severity: 'critical',
      category: 'seo',
      title: 'Missing title tag',
      description: 'The page has no title tag, which hurts search visibility and click-through rates.',
      evidence: { url: seo.url },
    });
  } else if (!seo.title.toLowerCase().includes(keyword.split(' ')[0]?.toLowerCase() ?? '')) {
    findings.push({
      severity: 'warning',
      category: 'seo',
      title: 'Title may not target keyword',
      description: `Title "${seo.title}" may not include the primary keyword "${keyword}".`,
      evidence: { url: seo.url, keyword },
    });
  }

  if (!seo.metaDescription) {
    findings.push({
      severity: 'warning',
      category: 'seo',
      title: 'Missing meta description',
      description: 'No meta description found. Write a concise summary with the target keyword and a soft CTA.',
      evidence: { url: seo.url },
    });
  }

  if (seo.h1.length === 0) {
    findings.push({
      severity: 'critical',
      category: 'seo',
      title: 'Missing H1',
      description: 'Page has no H1 heading. Add one that states the primary value proposition.',
      evidence: { url: seo.url },
    });
  }

  if (seo.ctas.length === 0) {
    findings.push({
      severity: 'warning',
      category: 'cro',
      title: 'No clear CTA detected',
      description: 'No prominent call-to-action buttons or links were found on the page.',
      evidence: { url: seo.url },
    });
  }

  if (seo.wordCount < 150) {
    findings.push({
      severity: 'info',
      category: 'seo',
      title: 'Thin page content',
      description: `Page has only ~${seo.wordCount} words. Local service pages typically need more substantive copy.`,
      evidence: { url: seo.url, wordCount: seo.wordCount },
    });
  }

  if (seo.jsonLd.length === 0) {
    findings.push({
      severity: 'info',
      category: 'technical',
      title: 'No JSON-LD structured data',
      description: 'Consider adding LocalBusiness or relevant schema markup for rich results.',
      evidence: { url: seo.url },
    });
  }

  return findings;
}

function buildSummary(
  businessName: string,
  keyword: string,
  findings: AuditFinding[],
  offline: boolean
): string {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;

  const modeNote = offline
    ? ' (offline heuristic audit — configure ANTHROPIC_API_KEY for full agent analysis)'
    : '';

  return [
    `Heuristic audit for ${businessName} targeting "${keyword}".`,
    `Found ${findings.length} issue(s): ${critical} critical, ${warning} warning.`,
    modeNote,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildRecommendations(findings: AuditFinding[]): string {
  const priority = findings
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 5)
    .map((f, i) => `${i + 1}. ${f.title}: ${f.description}`);

  if (priority.length === 0) {
    return 'No major issues detected by heuristic checks. Run a full agent audit with ANTHROPIC_API_KEY for deeper competitive and messaging analysis.';
  }

  return priority.join('\n');
}

export async function runOfflineResearchAudit(
  params: RunResearchAgentParams
): Promise<ResearchAgentResult> {
  const { targetUrl, keyword, businessName, location = 'London', leadId } = params;
  const toolTrace: ToolTraceEntry[] = [];
  const now = new Date().toISOString();
  const start = Date.now();

  let seo: SeoSignals;
  try {
    const { html, url } = await fetchPageContent(targetUrl);
    seo = extractSeoSignals(html, url);
    toolTrace.push({
      turn: 1,
      toolName: 'scrape_page_seo',
      input: { url: targetUrl, is_target: true },
      output: { seo, source: 'offline' },
      durationMs: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch target page';
    toolTrace.push({
      turn: 1,
      toolName: 'scrape_page_seo',
      input: { url: targetUrl },
      output: { error: message },
      durationMs: Date.now() - start,
      error: message,
    });

    return {
      audit: {
        lead_id: leadId ?? null,
        target_url: targetUrl,
        keyword,
        business_name: businessName,
        status: 'completed',
        summary: `Could not fetch ${targetUrl}: ${message}. Configure FIRECRAWL_API_KEY for JS-rendered sites.`,
        recommendations: 'Verify the URL is reachable and retry. Add FIRECRAWL_API_KEY if the site requires JavaScript rendering.',
        tool_trace: toolTrace,
        completed_at: now,
      },
      competitors: [],
      pages: [],
      findings: [],
      socialProfiles: [],
      toolTrace,
    };
  }

  const findings = buildSeoFindings(seo, keyword);

  const messagingStart = Date.now();
  const messagingIssues = await comparePageMessaging([seo]);
  for (const issue of messagingIssues) {
    findings.push({
      severity: issue.type.includes('missing') ? 'warning' : 'info',
      category: 'messaging',
      title: issue.type.replace(/_/g, ' '),
      description: issue.description,
      evidence: { pages: issue.pages, recommendation: issue.recommendation },
    });
  }
  toolTrace.push({
    turn: 2,
    toolName: 'compare_messaging',
    input: { urls: [seo.url] },
    output: { inconsistencies: messagingIssues },
    durationMs: Date.now() - messagingStart,
  });

  const socialStart = Date.now();
  const socialResult = await checkSocialPresence(businessName, location, targetUrl, seo);
  const socialProfiles: AuditSocialProfile[] = socialResult.profiles.map((p) => ({
    platform_id: p.platformId,
    profile_url: p.profileUrl,
    bio_text: p.bioText,
    seo_json: p.seoSignals,
    found_via: p.foundVia,
    status: p.status,
  }));

  for (const issue of socialResult.inconsistencies) {
    findings.push({
      severity: issue.type === 'missing_major_platforms' ? 'warning' : 'info',
      category: 'social',
      title: issue.type.replace(/_/g, ' '),
      description: issue.description,
      evidence: { platforms: issue.platforms, recommendation: issue.recommendation },
    });
  }

  toolTrace.push({
    turn: 3,
    toolName: 'check_social_presence',
    input: { businessName, location, websiteUrl: targetUrl },
    output: {
      searched: socialResult.searched,
      profileCount: socialProfiles.length,
      note: socialResult.searched ? undefined : 'SerpAPI key not configured',
    },
    durationMs: Date.now() - socialStart,
  });

  const pages: AuditPage[] = [
    {
      url: seo.url,
      is_target: true,
      page_type: 'homepage',
      seo_json: seo,
      scraped_at: now,
    },
  ];

  const competitors: AuditCompetitor[] = [];
  const summary = buildSummary(businessName, keyword, findings, true);
  const recommendations = buildRecommendations(findings);

  return {
    audit: {
      lead_id: leadId ?? null,
      target_url: targetUrl,
      keyword,
      business_name: businessName,
      status: 'completed',
      summary,
      recommendations,
      tool_trace: toolTrace,
      completed_at: now,
    },
    competitors,
    pages,
    findings,
    socialProfiles,
    toolTrace,
  };
}
