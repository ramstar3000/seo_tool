import * as cheerio from 'cheerio';
import { fetchPageContent } from '@/lib/research/fetch-page';

const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|mp3|css|js|xml|ico)(\?|$)/i;

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function isSameDomain(baseUrl: string, candidate: string): boolean {
  return normalizeDomain(baseUrl) === normalizeDomain(candidate);
}

function isInternalPageUrl(baseUrl: string, href: string): boolean {
  const resolved = resolveUrl(baseUrl, href);
  if (!resolved) return false;
  if (!isSameDomain(baseUrl, resolved)) return false;
  if (SKIP_EXTENSIONS.test(resolved)) return false;
  if (resolved.startsWith('mailto:') || resolved.startsWith('tel:')) return false;
  return true;
}

export async function discoverSitemapUrls(domain: string): Promise<string[]> {
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  const origin = new URL(base).origin;
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const urls = new Set<string>();

  for (const sitemapUrl of candidates) {
    try {
      const { html } = await fetchPageContent(sitemapUrl);
      const locMatches = html.match(/<loc>([^<]+)<\/loc>/gi) ?? [];

      for (const match of locMatches) {
        const loc = match.replace(/<\/?loc>/gi, '').trim();
        if (loc.endsWith('.xml')) continue;
        if (isInternalPageUrl(origin, loc)) {
          urls.add(loc);
        }
      }
    } catch {
      // Sitemap may not exist
    }
  }

  return Array.from(urls);
}

export function findSiblingPages(baseUrl: string, html: string, maxPages = 8): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const resolved = resolveUrl(baseUrl, href);
    if (!resolved || !isInternalPageUrl(baseUrl, resolved)) return;

    found.add(resolved.split('#')[0]);
  });

  const siblings = Array.from(found)
    .filter((url) => url !== baseUrl.split('#')[0])
    .slice(0, maxPages);

  return siblings;
}

export async function discoverInternalPages(
  rootUrl: string,
  maxPages = 8
): Promise<string[]> {
  const urls = new Set<string>([rootUrl]);

  try {
    const domain = new URL(rootUrl).origin;
    const sitemapUrls = await discoverSitemapUrls(domain);
    for (const url of sitemapUrls.slice(0, maxPages)) {
      urls.add(url);
    }
  } catch {
    // Continue with homepage links only
  }

  try {
    const { html, url } = await fetchPageContent(rootUrl);
    for (const sibling of findSiblingPages(url, html, maxPages)) {
      urls.add(sibling);
    }
  } catch {
    // Return whatever we have from sitemap
  }

  return Array.from(urls).slice(0, maxPages + 1);
}
