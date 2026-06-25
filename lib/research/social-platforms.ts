export interface SocialReferencePlatform {
  id: string;
  name: string;
  domain: string;
  /** Optional regex to validate profile URLs on this platform */
  profileUrlPattern?: RegExp;
  /** site: operator target for SerpAPI discovery (defaults to domain) */
  searchSite?: string;
  seoNotes: string;
}

export const SOCIAL_REFERENCE_PLATFORMS: SocialReferencePlatform[] = [
  {
    id: 'google_business',
    name: 'Google Business Profile',
    domain: 'google.com',
    searchSite: 'google.com/maps',
    profileUrlPattern: /google\.(com|[a-z]{2,3})\/maps/i,
    seoNotes:
      'Primary local discovery surface. NAP consistency, categories, photos, and review velocity drive map pack rankings.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    domain: 'linkedin.com',
    searchSite: 'linkedin.com/company',
    profileUrlPattern: /linkedin\.com\/(company|in)\//i,
    seoNotes:
      'B2B credibility and branded SERP real estate. Tagline and company description should mirror site value prop.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    domain: 'instagram.com',
    searchSite: 'instagram.com',
    profileUrlPattern: /instagram\.com\/[^/?#]+/i,
    seoNotes:
      'Visual brand consistency and bio link CTA. Bio should echo primary keyword and location for local businesses.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    domain: 'facebook.com',
    searchSite: 'facebook.com',
    profileUrlPattern: /facebook\.com\/[^/?#]+/i,
    seoNotes:
      'Local page NAP, hours, and reviews feed Google signals. About section should match website messaging.',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    domain: 'x.com',
    searchSite: 'x.com',
    profileUrlPattern: /(twitter|x)\.com\/[^/?#]+/i,
    seoNotes:
      'Brand handle consistency and bio CTA. Often surfaces in branded search — keep name and tagline aligned.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    domain: 'youtube.com',
    searchSite: 'youtube.com',
    profileUrlPattern: /youtube\.com\/(channel|c|@|user)\//i,
    seoNotes:
      'Channel description and links reinforce topical authority. Video titles should use target keywords naturally.',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    domain: 'tiktok.com',
    searchSite: 'tiktok.com',
    profileUrlPattern: /tiktok\.com\/@[^/?#]+/i,
    seoNotes:
      'Growing local discovery channel for younger demographics. Bio link and display name should match brand.',
  },
  {
    id: 'yelp',
    name: 'Yelp',
    domain: 'yelp.com',
    searchSite: 'yelp.com/biz',
    profileUrlPattern: /yelp\.(com|[a-z]{2,3})\/biz\//i,
    seoNotes:
      'High-intent directory for service businesses. Business name, categories, and photos must match GBP and website.',
  },
  {
    id: 'trustpilot',
    name: 'Trustpilot',
    domain: 'trustpilot.com',
    searchSite: 'trustpilot.com/review',
    profileUrlPattern: /trustpilot\.com\/review\//i,
    seoNotes:
      'Review-rich SERP snippet for trust queries. Profile description should reinforce service area and specialties.',
  },
  {
    id: 'apple_business',
    name: 'Apple Business Connect',
    domain: 'business.apple.com',
    searchSite: 'business.apple.com',
    seoNotes:
      'Apple Maps and Siri local results. NAP and categories should mirror GBP for iOS user discovery.',
  },
  {
    id: 'bing_places',
    name: 'Bing Places',
    domain: 'bing.com',
    searchSite: 'bing.com/maps',
    profileUrlPattern: /bing\.com\/maps/i,
    seoNotes:
      'Bing Maps and Copilot local citations. Duplicate GBP data accurately to capture secondary search share.',
  },
];

function normalizeDomain(urlOrDomain: string): string {
  const trimmed = urlOrDomain.trim().toLowerCase();
  try {
    const withProtocol = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return trimmed.replace(/^www\./, '').split('/')[0];
  }
}

export function getPlatformByDomain(url: string): SocialReferencePlatform | undefined {
  const hostname = normalizeDomain(url);

  return SOCIAL_REFERENCE_PLATFORMS.find((platform) => {
    const platformDomain = platform.domain.replace(/^www\./, '');
    return hostname === platformDomain || hostname.endsWith(`.${platformDomain}`);
  });
}

export function getPlatformById(platformId: string): SocialReferencePlatform | undefined {
  return SOCIAL_REFERENCE_PLATFORMS.find((p) => p.id === platformId);
}

export function buildProfileSearchUrl(
  platformId: string,
  businessName: string,
  location?: string
): string {
  const platform = getPlatformById(platformId);
  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  const site = platform.searchSite ?? platform.domain;
  const locationPart = location ? ` ${location}` : '';
  const query = `site:${site} "${businessName.trim()}"${locationPart}`;
  const params = new URLSearchParams({ q: query });

  return `https://www.google.com/search?${params.toString()}`;
}

export function isSocialOrDirectoryUrl(url: string): boolean {
  const platform = getPlatformByDomain(url);
  if (!platform) return false;

  if (platform.profileUrlPattern) {
    return platform.profileUrlPattern.test(url);
  }

  return true;
}

export function matchPlatformFromUrl(url: string): SocialReferencePlatform | undefined {
  for (const platform of SOCIAL_REFERENCE_PLATFORMS) {
    const hostname = normalizeDomain(url);
    const platformDomain = platform.domain.replace(/^www\./, '');
    const domainMatch =
      hostname === platformDomain || hostname.endsWith(`.${platformDomain}`);

    if (!domainMatch) continue;

    if (platform.profileUrlPattern && !platform.profileUrlPattern.test(url)) {
      continue;
    }

    return platform;
  }

  return undefined;
}
