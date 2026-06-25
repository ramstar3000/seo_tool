import { getFirecrawlApiKey } from '@/lib/env';

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'SynapseCRO-ResearchBot/1.0 (+https://synapsecro.local; site-audit)';

export interface FetchPageResult {
  html: string;
  url: string;
  source: 'firecrawl' | 'cheerio';
}

function sanitizeFetchError(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 200);
}

async function fetchWithCheerio(url: string): Promise<FetchPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    const html = await response.text();
    return { html, url: response.url || url, source: 'cheerio' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed';
    throw new Error(sanitizeFetchError(message));
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithFirecrawl(url: string, apiKey: string): Promise<FetchPageResult> {
  const { default: Firecrawl } = await import('@mendable/firecrawl-js');
  const firecrawl = new Firecrawl({ apiKey });

  try {
    const result = await firecrawl.scrape(url, {
      formats: ['html'],
      timeout: FETCH_TIMEOUT_MS,
    });

    const html = result.html;
    if (!html) {
      throw new Error('Firecrawl returned no HTML content');
    }

    return { html, url: result.metadata?.sourceURL ?? url, source: 'firecrawl' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firecrawl scrape failed';
    throw new Error(sanitizeFetchError(message));
  }
}

export async function fetchPageContent(url: string): Promise<FetchPageResult> {
  const firecrawlKey = getFirecrawlApiKey();

  if (firecrawlKey) {
    try {
      return await fetchWithFirecrawl(url, firecrawlKey);
    } catch {
      // Fall back to direct fetch when Firecrawl fails
    }
  }

  return fetchWithCheerio(url);
}
