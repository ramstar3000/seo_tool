import * as cheerio from 'cheerio';
import {
  buildProfileSearchUrl,
  getPlatformById,
  matchPlatformFromUrl,
  SOCIAL_REFERENCE_PLATFORMS,
} from '@/lib/research/social-platforms';
import { fetchPageContent } from '@/lib/research/fetch-page';
import { searchGoogle } from '@/lib/research/serp';
import { getSerpApiKey } from '@/lib/env';
import type { SeoSignals, SocialMessagingIssue, SocialSeoSignals } from '@/lib/research/types';

export type SocialProfileStatus = 'found' | 'missing' | 'not_searched' | 'error';

export interface DiscoveredSocialProfile {
  platformId: string;
  platformName: string;
  status: SocialProfileStatus;
  profileUrl: string | null;
  searchUrl: string;
  foundVia: 'serp' | 'website_link' | null;
  bioText: string | null;
  seoSignals: SocialSeoSignals | null;
  error?: string;
}

export interface SocialPresenceResult {
  profiles: DiscoveredSocialProfile[];
  searched: boolean;
  inconsistencies: SocialMessagingIssue[];
}

const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractPhone(text: string): string | null {
  const match = text.match(PHONE_PATTERN);
  return match?.[0]?.trim() ?? null;
}

function pickBestResult(
  results: Array<{ link: string; title: string }>,
  platformId: string
): { link: string; title: string } | null {
  for (const result of results) {
    const matched = matchPlatformFromUrl(result.link);
    if (matched?.id === platformId) {
      return result;
    }
  }
  return results[0] ?? null;
}

async function discoverViaSerp(
  businessName: string,
  location: string
): Promise<Map<string, { url: string; title: string }>> {
  const found = new Map<string, { url: string; title: string }>();

  for (const platform of SOCIAL_REFERENCE_PLATFORMS) {
    const site = platform.searchSite ?? platform.domain;
    const query = `site:${site} "${businessName}" ${location}`;

    try {
      const results = await searchGoogle(query, { location, num: 3 });
      const best = pickBestResult(results, platform.id);
      if (best) {
        found.set(platform.id, { url: best.link, title: best.title });
      }
    } catch {
      // Skip failed platform searches
    }
  }

  return found;
}

function extractLinksFromWebsite(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    try {
      const absolute = new URL(href, baseUrl).href;
      links.add(absolute);
    } catch {
      // Skip invalid URLs
    }
  });

  return Array.from(links);
}

export async function extractSocialSeoSignals(
  url: string,
  platformId: string
): Promise<SocialSeoSignals> {
  const platform = getPlatformById(platformId);
  const empty: SocialSeoSignals = {
    url,
    platformId,
    platformName: platform?.name ?? platformId,
    title: null,
    description: null,
    bio: null,
    phone: null,
    cta: null,
  };

  try {
    const { html } = await fetchPageContent(url);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').first().text().trim() ||
      null;

    const description =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      null;

    const bioCandidates = [
      $('meta[name="twitter:description"]').attr('content'),
      $('[data-testid="about-us"]').text(),
      $('.org-top-card-summary__tagline').text(),
      $('h1').first().text(),
    ]
      .map((t) => t?.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const bio = bioCandidates[0] ?? description;
    const bodyText = $('body').text();
    const phone = extractPhone(bodyText);
    const cta =
      $('a[href*="book"], a[href*="contact"], a[href*="quote"]')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim() || null;

    return {
      url,
      platformId,
      platformName: platform?.name ?? platformId,
      title,
      description,
      bio: bio ?? null,
      phone,
      cta: cta || null,
    };
  } catch {
    return empty;
  }
}

function namesLikelyMatch(a: string, b: string): boolean {
  const normA = normalizeText(a).replace(/[^a-z0-9\s]/g, '');
  const normB = normalizeText(b).replace(/[^a-z0-9\s]/g, '');
  if (!normA || !normB) return true;
  return normA.includes(normB) || normB.includes(normA);
}

function taglinesLikelyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (normA === normB) return true;
  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 3));
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize === 0 || overlap / minSize >= 0.3;
}

export function compareSocialMessaging(
  websiteSeo: SeoSignals | null,
  socialProfiles: DiscoveredSocialProfile[]
): SocialMessagingIssue[] {
  const issues: SocialMessagingIssue[] = [];
  const foundProfiles = socialProfiles.filter((p) => p.status === 'found' && p.seoSignals);

  if (!websiteSeo) {
    return issues;
  }

  const websiteName =
    websiteSeo.title?.split(/[|\-–]/)[0]?.trim() ?? websiteSeo.h1[0] ?? null;
  const websiteTagline = websiteSeo.metaDescription ?? websiteSeo.ogDescription ?? websiteSeo.h1[0] ?? null;
  const websitePhone = extractPhone(
    [websiteSeo.title, websiteSeo.metaDescription, ...websiteSeo.h1].filter(Boolean).join(' ')
  );
  const websiteCta = websiteSeo.ctas[0] ?? null;

  for (const profile of foundProfiles) {
    const signals = profile.seoSignals;
    if (!signals) continue;

    if (websiteName && signals.title && !namesLikelyMatch(websiteName, signals.title)) {
      issues.push({
        type: 'business_name_mismatch',
        platforms: [profile.platformName, 'Website'],
        description: `Business name on ${profile.platformName} ("${signals.title}") differs from website ("${websiteName}")`,
        recommendation: 'Standardize legal/trading name spelling across all profiles and the website.',
      });
    }

    const socialTagline = signals.bio ?? signals.description;
    if (websiteTagline && socialTagline && !taglinesLikelyMatch(websiteTagline, socialTagline)) {
      issues.push({
        type: 'tagline_drift',
        platforms: [profile.platformName, 'Website'],
        description: `${profile.platformName} bio/tagline diverges from website meta/H1 messaging`,
        recommendation: 'Align value proposition language so branded search shows consistent messaging.',
      });
    }

    if (websitePhone && signals.phone && normalizeText(websitePhone) !== normalizeText(signals.phone)) {
      issues.push({
        type: 'phone_mismatch',
        platforms: [profile.platformName, 'Website'],
        description: `Phone on ${profile.platformName} (${signals.phone}) differs from website (${websitePhone})`,
        recommendation: 'Use one primary local phone number everywhere for NAP consistency.',
      });
    }

    if (websiteCta && signals.cta && !taglinesLikelyMatch(websiteCta, signals.cta)) {
      issues.push({
        type: 'cta_inconsistency',
        platforms: [profile.platformName, 'Website'],
        description: `CTA language on ${profile.platformName} ("${signals.cta}") differs from website ("${websiteCta}")`,
        recommendation: 'Use a consistent primary CTA (Book, Call, Get Quote) across web and social profiles.',
      });
    }
  }

  const missingMajor = socialProfiles.filter(
    (p) =>
      p.status === 'missing' &&
      ['google_business', 'facebook', 'linkedin', 'yelp'].includes(p.platformId)
  );

  if (missingMajor.length > 0) {
    issues.push({
      type: 'missing_major_platforms',
      platforms: missingMajor.map((p) => p.platformName),
      description: `No profiles found on: ${missingMajor.map((p) => p.platformName).join(', ')}`,
      recommendation: 'Claim and optimize listings on these high-SEO platforms for local visibility.',
    });
  }

  return issues;
}

export async function discoverSocialProfiles(
  businessName: string,
  location: string,
  websiteUrl?: string
): Promise<SocialPresenceResult> {
  const hasSerp = Boolean(getSerpApiKey());
  const serpResults = hasSerp ? await discoverViaSerp(businessName, location) : new Map();

  const websiteLinks = new Map<string, string>();
  if (websiteUrl) {
    try {
      const { html } = await fetchPageContent(websiteUrl);
      for (const link of extractLinksFromWebsite(html, websiteUrl)) {
        const platform = matchPlatformFromUrl(link);
        if (platform) {
          websiteLinks.set(platform.id, link);
        }
      }
    } catch {
      // Website link extraction is best-effort
    }
  }

  const profiles: DiscoveredSocialProfile[] = [];

  for (const platform of SOCIAL_REFERENCE_PLATFORMS) {
    const searchUrl = buildProfileSearchUrl(platform.id, businessName, location);
    const serpHit = serpResults.get(platform.id);
    const websiteHit = websiteLinks.get(platform.id);

    let status: SocialProfileStatus = hasSerp ? 'missing' : 'not_searched';
    let profileUrl: string | null = null;
    let foundVia: 'serp' | 'website_link' | null = null;

    if (websiteHit) {
      profileUrl = websiteHit;
      status = 'found';
      foundVia = 'website_link';
    } else if (serpHit) {
      profileUrl = serpHit.url;
      status = 'found';
      foundVia = 'serp';
    }

    let bioText: string | null = null;
    let seoSignals: SocialSeoSignals | null = null;
    let error: string | undefined;

    if (profileUrl && status === 'found') {
      try {
        seoSignals = await extractSocialSeoSignals(profileUrl, platform.id);
        bioText = seoSignals.bio ?? seoSignals.description;
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to extract profile signals';
        status = 'error';
      }
    }

    profiles.push({
      platformId: platform.id,
      platformName: platform.name,
      status,
      profileUrl,
      searchUrl,
      foundVia,
      bioText,
      seoSignals,
      error,
    });
  }

  return {
    profiles,
    searched: hasSerp,
    inconsistencies: [],
  };
}

export async function checkSocialPresence(
  businessName: string,
  location: string,
  websiteUrl?: string,
  websiteSeo?: SeoSignals | null
): Promise<SocialPresenceResult> {
  const result = await discoverSocialProfiles(businessName, location, websiteUrl);
  result.inconsistencies = compareSocialMessaging(websiteSeo ?? null, result.profiles);
  return result;
}
