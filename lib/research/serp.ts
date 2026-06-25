import { getSerpApiKey } from '@/lib/env';
import type { SerpAd, SerpOrganicResult } from '@/lib/research/types';

interface SerpApiOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpApiAdResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  ads?: SerpApiAdResult[];
  error?: string;
}

export interface SerpSearchOptions {
  num?: number;
  googleDomain?: string;
  gl?: string;
  hl?: string;
  location?: string;
}

function parseBusinessName(title: string): string {
  const separators = [' - ', ' | ', ' – '];
  for (const sep of separators) {
    if (title.includes(sep)) return title.split(sep)[0].trim();
  }
  return title.trim();
}

async function fetchSerpApi(
  keyword: string,
  options: SerpSearchOptions = {}
): Promise<SerpApiResponse | null> {
  const apiKey = getSerpApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    engine: 'google',
    q: keyword,
    google_domain: options.googleDomain ?? 'google.co.uk',
    gl: options.gl ?? 'uk',
    hl: options.hl ?? 'en',
    num: String(options.num ?? 10),
    api_key: apiKey,
  });

  if (options.location) {
    params.set('location', options.location);
  }

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) return null;

  const data = (await response.json()) as SerpApiResponse;
  if (data.error) return null;

  return data;
}

export async function findCompetitors(
  keyword: string,
  location = 'London'
): Promise<SerpOrganicResult[]> {
  const data = await fetchSerpApi(keyword, { location, num: 10 });
  if (!data?.organic_results) return [];

  return data.organic_results
    .filter((r) => r.position && r.title && r.link)
    .map((r) => ({
      position: r.position as number,
      title: r.title as string,
      link: r.link as string,
      snippet: r.snippet ?? null,
    }));
}

export async function searchGoogle(
  query: string,
  options: SerpSearchOptions = {}
): Promise<SerpOrganicResult[]> {
  const data = await fetchSerpApi(query, { ...options, num: options.num ?? 5 });
  if (!data?.organic_results) return [];

  return data.organic_results
    .filter((r) => r.title && r.link)
    .map((r, index) => ({
      position: r.position ?? index + 1,
      title: r.title as string,
      link: r.link as string,
      snippet: r.snippet ?? null,
    }));
}

export async function getSerpAds(keyword: string): Promise<SerpAd[]> {
  const data = await fetchSerpApi(keyword, { num: 10 });
  if (!data?.ads) return [];

  return data.ads
    .filter((ad) => ad.title && ad.link)
    .map((ad, index) => ({
      position: ad.position ?? index + 1,
      title: ad.title as string,
      link: ad.link as string,
      snippet: ad.snippet ?? null,
    }));
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
  const data = await fetchSerpApi(keyword, { num: 10 });
  if (!data?.organic_results) return [];

  const leads: Array<{
    business_name: string;
    rank_position: number;
    website_url: string;
    title: string;
  }> = [];

  for (const result of data.organic_results) {
    const position = result.position;
    if (!position || !positions.includes(position)) continue;
    if (!result.title || !result.link) continue;

    leads.push({
      business_name: parseBusinessName(result.title),
      rank_position: position,
      website_url: result.link,
      title: result.title,
    });
  }

  return leads;
}

export { parseBusinessName };
