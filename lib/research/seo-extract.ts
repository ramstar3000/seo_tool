import * as cheerio from 'cheerio';
import type { SeoSignals } from '@/lib/research/types';

const CTA_SELECTORS = [
  'a.btn',
  'a.button',
  'button',
  'a[class*="cta"]',
  'a[class*="CTA"]',
  '[role="button"]',
  'input[type="submit"]',
];

function extractJsonLd($: cheerio.CheerioAPI): unknown[] {
  const items: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;

    try {
      items.push(JSON.parse(raw));
    } catch {
      // Skip malformed JSON-LD blocks
    }
  });

  return items;
}

function extractHeadings($: cheerio.CheerioAPI, tag: 'h1' | 'h2' | 'h3'): string[] {
  const headings: string[] = [];

  $(tag).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) headings.push(text);
  });

  return headings;
}

function extractCtas($: cheerio.CheerioAPI): string[] {
  const ctas = new Set<string>();

  for (const selector of CTA_SELECTORS) {
    $(selector).each((_, el) => {
      const text =
        $(el).attr('value')?.trim() ||
        $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length <= 80) {
        ctas.add(text);
      }
    });
  }

  return Array.from(ctas).slice(0, 20);
}

function countWords($: cheerio.CheerioAPI): number {
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  if (!bodyText) return 0;
  return bodyText.split(' ').filter(Boolean).length;
}

export function extractSeoSignals(html: string, url: string): SeoSignals {
  const $ = cheerio.load(html);

  return {
    url,
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr('content')?.trim() || null,
    h1: extractHeadings($, 'h1'),
    h2: extractHeadings($, 'h2'),
    h3: extractHeadings($, 'h3'),
    canonical: $('link[rel="canonical"]').attr('href')?.trim() || null,
    robots: $('meta[name="robots"]').attr('content')?.trim() || null,
    ogTitle: $('meta[property="og:title"]').attr('content')?.trim() || null,
    ogDescription: $('meta[property="og:description"]').attr('content')?.trim() || null,
    jsonLd: extractJsonLd($),
    ctas: extractCtas($),
    wordCount: countWords($),
  };
}
