import * as cheerio from 'cheerio';
import { getFirecrawlApiKey } from '@/lib/env';

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'SynapseCRO-ResearchBot/1.0 (+https://synapsecro.local; site-audit)';

const GATE_PAGE_MARKERS = [
  'checking your browser',
  'please enable javascript',
  'enable javascript to continue',
  'cf-browser-verification',
  'just a moment',
  'access denied',
  'bot detection',
  'complete the captcha',
];

export interface FetchPageResult {
  html: string;
  url: string;
  source: 'firecrawl' | 'cheerio';
}

function sanitizeFetchError(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 200);
}

function isInsufficientHtml(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length < 500) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (GATE_PAGE_MARKERS.some((marker) => lower.includes(marker))) {
    return true;
  }

  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  if (bodyText.length < 50) {
    return true;
  }

  const spaRoot = $('#root, #app, #__next, [data-reactroot]').first();
  if (
    spaRoot.length > 0 &&
    spaRoot.text().replace(/\s+/g, ' ').trim().length < 30 &&
    $('script').length >= 2
  ) {
    return true;
  }

  return false;
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
  let cheerioError: Error | undefined;
  let cheerioResult: FetchPageResult | undefined;

  try {
    cheerioResult = await fetchWithCheerio(url);
    if (!isInsufficientHtml(cheerioResult.html)) {
      return cheerioResult;
    }
  } catch (error) {
    cheerioError = error instanceof Error ? error : new Error('Fetch failed');
  }

  const firecrawlKey = getFirecrawlApiKey();
  if (firecrawlKey) {
    try {
      return await fetchWithFirecrawl(url, firecrawlKey);
    } catch (error) {
      const firecrawlMessage =
        error instanceof Error ? error.message : 'Firecrawl scrape failed';
      if (cheerioError) {
        throw new Error(
          `${cheerioError.message}; Firecrawl fallback also failed: ${firecrawlMessage}`
        );
      }
      throw new Error(
        `Direct fetch returned insufficient content; Firecrawl fallback also failed: ${firecrawlMessage}`
      );
    }
  }

  if (cheerioError) {
    throw cheerioError;
  }

  return cheerioResult!;
}
