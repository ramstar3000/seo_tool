import { findCompetitors, parseBusinessName } from '@/lib/research/serp';
import type { SerpOrganicResult } from '@/lib/research/types';

export interface MustDoItem {
  title: string;
  description: string;
}

export interface LightAuditResult {
  keyword: string;
  location: string;
  targetUrl: string;
  businessName: string;
  /** Position in SERP (1-based), null if not in top results. */
  rankPosition: number | null;
  isFirst: boolean;
  leader: { name: string; url: string; position: number } | null;
  competitors: SerpOrganicResult[];
  mustDo: MustDoItem[];
  /** One-line hook for cold outreach. */
  hook: string;
  summary: string;
  recommendations: string;
}

export function normalizeHostname(url: string): string {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.replace(/^www\./i, '').toLowerCase();
  }
}

export function findRankInSerp(
  results: SerpOrganicResult[],
  targetUrl: string
): { position: number; result: SerpOrganicResult } | null {
  const targetHost = normalizeHostname(targetUrl);

  for (const result of results) {
    const host = normalizeHostname(result.link);
    if (host === targetHost || host.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${host}`)) {
      return { position: result.position, result };
    }
  }

  return null;
}

function buildMustDo(params: {
  keyword: string;
  location: string;
  businessName: string;
  rankPosition: number | null;
  leader: LightAuditResult['leader'];
}): MustDoItem[] {
  const { keyword, location, businessName, rankPosition, leader } = params;
  const items: MustDoItem[] = [];

  if (rankPosition === 1) {
    items.push({
      title: 'Defend #1',
      description: `You hold #1 for "${keyword}" in ${location} — keep the homepage title and H1 aligned with that phrase so competitors don't slip past.`,
    });
    return items.slice(0, 3);
  }

  const leaderLabel = leader?.name ?? 'the current #1';

  if (rankPosition == null) {
    items.push({
      title: 'Get on the map',
      description: `You're not in the top results for "${keyword}" in ${location} — ${leaderLabel} owns #1. Fix your homepage title and Google Business Profile first.`,
    });
  } else {
    items.push({
      title: 'You are not first',
      description: `${leaderLabel} is #1 for "${keyword}" in ${location}; ${businessName} is #${rankPosition}. Closing that gap starts with title tag + H1.`,
    });
  }

  if (rankPosition != null && rankPosition > 1 && rankPosition <= 5) {
    items.push({
      title: 'Steal one spot',
      description: `At #${rankPosition}, one stronger homepage headline and a clearer local signal (address, neighbourhood) can move you above the site above you.`,
    });
  }

  items.push({
    title: 'Match search intent',
    description: `Top results for "${keyword}" lead with the service + area — mirror that pattern on ${businessName}'s homepage above the fold.`,
  });

  return items.slice(0, 3);
}

function buildHook(params: {
  keyword: string;
  location: string;
  businessName: string;
  rankPosition: number | null;
  leader: LightAuditResult['leader'];
}): string {
  const { keyword, location, businessName, rankPosition, leader } = params;

  if (rankPosition === 1) {
    return `${businessName} is #1 for "${keyword}" in ${location} — worth defending that spot.`;
  }

  const leaderPart = leader ? `${leader.name} is #1` : 'Someone else is #1';

  if (rankPosition == null) {
    return `${leaderPart} for "${keyword}" in ${location} — ${businessName} isn't in the top results yet.`;
  }

  return `${leaderPart} for "${keyword}" in ${location} — you're #${rankPosition}, not first.`;
}

function formatRecommendations(mustDo: MustDoItem[]): string {
  return mustDo.map((item, i) => `${i + 1}. MUST_DO: ${item.title} — ${item.description}`).join('\n');
}

export async function runLightLeadAudit(params: {
  businessName: string;
  keyword: string;
  websiteUrl: string;
  location?: string;
}): Promise<LightAuditResult> {
  const location = params.location ?? 'London';
  const competitors = await findCompetitors(params.keyword, location);
  const match = findRankInSerp(competitors, params.websiteUrl);
  const rankPosition = match?.position ?? null;
  const leaderResult = competitors[0] ?? null;
  const leader = leaderResult
    ? {
        name: parseBusinessName(leaderResult.title),
        url: leaderResult.link,
        position: leaderResult.position,
      }
    : null;

  const isFirst = rankPosition === 1;
  const mustDo = buildMustDo({
    keyword: params.keyword,
    location,
    businessName: params.businessName,
    rankPosition,
    leader,
  });
  const hook = buildHook({
    keyword: params.keyword,
    location,
    businessName: params.businessName,
    rankPosition,
    leader,
  });

  return {
    keyword: params.keyword,
    location,
    targetUrl: params.websiteUrl,
    businessName: params.businessName,
    rankPosition,
    isFirst,
    leader,
    competitors,
    mustDo,
    hook,
    summary: hook,
    recommendations: formatRecommendations(mustDo),
  };
}

export function isLightAuditTrace(toolTrace: unknown): boolean {
  if (!Array.isArray(toolTrace)) return false;
  return toolTrace.some(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      'toolName' in entry &&
      (entry as { toolName: string }).toolName === 'light_serp_scan'
  );
}
