import { getTavilyApiKey } from '@/lib/env';
import { isWithinBudget } from '@/lib/cost/check';
import { recordApiUsage } from '@/lib/cost/tracker';
import type { SerpAd, SerpOrganicResult } from '@/lib/research/types';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
  error?: string;
}

export interface SerpSearchOptions {
  num?: number;
  location?: string;
  /** Restrict results to these domains (Tavily include_domains). */
  includeDomains?: string[];
}

function parseBusinessName(title: string): string {
  const separators = [' - ', ' | ', ' – '];
  for (const sep of separators) {
    if (title.includes(sep)) return title.split(sep)[0].trim();
  }
  return title.trim();
}

function buildQuery(query: string, location?: string): string {
  if (!location) return query;
  const lower = query.toLowerCase();
  if (lower.includes(location.toLowerCase())) return query;
  return `${query} ${location}`;
}

async function fetchTavily(
  query: string,
  options: SerpSearchOptions = {}
): Promise<TavilySearchResponse | null> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return null;

  if (!(await isWithinBudget('tavily'))) {
    console.warn('[serp] Tavily spend cap reached; skipping search');
    return null;
  }

  const body: Record<string, unknown> = {
    query: buildQuery(query, options.location),
    max_results: Math.min(Math.max(options.num ?? 10, 1), 20),
    search_depth: 'basic',
  };

  if (options.includeDomains?.length) {
    body.include_domains = options.includeDomains;
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as TavilySearchResponse & { detail?: string };
    if (data.error || data.detail) return null;

    await recordApiUsage({
      provider: 'tavily',
      operation: 'search',
      units: 1,
      metadata: { query: buildQuery(query, options.location), search_depth: 'basic' },
    });

    return data;
  } catch {
    return null;
  }
}

function mapTavilyResults(data: TavilySearchResponse | null): SerpOrganicResult[] {
  if (!data?.results) return [];

  return data.results
    .filter((r) => r.title && r.url)
    .map((r, index) => ({
      position: index + 1,
      title: r.title as string,
      link: r.url as string,
      snippet: r.content ?? null,
    }));
}

export async function findCompetitors(
  keyword: string,
  location = 'London'
): Promise<SerpOrganicResult[]> {
  const data = await fetchTavily(keyword, { location, num: 10 });
  return mapTavilyResults(data);
}

export async function searchGoogle(
  query: string,
  options: SerpSearchOptions = {}
): Promise<SerpOrganicResult[]> {
  const data = await fetchTavily(query, { ...options, num: options.num ?? 5 });
  return mapTavilyResults(data);
}

/** Tavily does not expose paid search ads — returns empty; agent uses organic competitors instead. */
export async function getSerpAds(_keyword: string): Promise<SerpAd[]> {
  return [];
}

export async function fetchSerpLeadsForKeyword(
  keyword: string,
  positions: number[] = [3, 4]
): Promise<
  Array<{
    business_name: string;
    rank_position: number;
    website_url: string;
    title: string;
  }>
> {
  const data = await fetchTavily(keyword, { location: 'London', num: 10 });
  const results = mapTavilyResults(data);

  const leads: Array<{
    business_name: string;
    rank_position: number;
    website_url: string;
    title: string;
  }> = [];

  for (const result of results) {
    if (!positions.includes(result.position)) continue;

    leads.push({
      business_name: parseBusinessName(result.title),
      rank_position: result.position,
      website_url: result.link,
      title: result.title,
    });
  }

  return leads;
}

export { parseBusinessName };
