import type { SeoSignals } from '@/lib/research/types';
import type { SitePlatformId } from '@/lib/fix-pack/types';

export interface PlatformInfo {
  id: SitePlatformId;
  label: string;
  supportsCodeInjection: boolean;
  supportsAutoPr: boolean;
  seoSettingsHint: string;
  customCodeHint: string;
  playbookPreamble: string;
}

const PLATFORMS: Record<SitePlatformId, PlatformInfo> = {
  webflow: {
    id: 'webflow',
    label: 'Webflow',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Project settings → SEO → Default title & meta description; per-page: Page settings → SEO settings',
    customCodeHint: 'Project settings → Custom code → Head code (for JSON-LD)',
    playbookPreamble: 'In the Webflow Designer, select the page or open Project settings as noted in each step.',
  },
  wix: {
    id: 'wix',
    label: 'Wix',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Marketing & SEO → SEO → SEO Settings (site-wide); per-page: Page SEO on each page',
    customCodeHint: 'Settings → Custom Code → Add code to Head (for JSON-LD)',
    playbookPreamble: 'In the Wix dashboard, use Marketing & SEO or the page editor as described in each step.',
  },
  squarespace: {
    id: 'squarespace',
    label: 'Squarespace',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Pages → gear icon → SEO → SEO title & description',
    customCodeHint: 'Settings → Advanced → Code Injection → Header (for JSON-LD)',
    playbookPreamble: 'In Squarespace, edit the page or use Settings → SEO as noted in each step.',
  },
  shopify: {
    id: 'shopify',
    label: 'Shopify',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Online Store → Preferences → Homepage title & meta; per-page: Search engine listing on each page/product',
    customCodeHint: 'Online Store → Themes → Edit code → theme.liquid before </head> (for JSON-LD)',
    playbookPreamble: 'In Shopify admin, use Online Store or the theme editor as described in each step.',
  },
  wordpress: {
    id: 'wordpress',
    label: 'WordPress',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Use Yoast/Rank Math or page editor → SEO title & meta description',
    customCodeHint: 'Appearance → Theme file editor or a header plugin for JSON-LD',
    playbookPreamble: 'In wp-admin, edit the page/post or use your SEO plugin as noted in each step.',
  },
  framer: {
    id: 'framer',
    label: 'Framer',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Page → Settings → General → Title & description',
    customCodeHint: 'Site settings → General → Custom code → Head (for JSON-LD)',
    playbookPreamble: 'In Framer, open the page settings or site settings as described in each step.',
  },
  carrd: {
    id: 'carrd',
    label: 'Carrd',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Site settings → General → Title & description',
    customCodeHint: 'Site settings → Settings → Head (for JSON-LD)',
    playbookPreamble: 'In Carrd, use Site settings or element settings as noted in each step.',
  },
  bubble: {
    id: 'bubble',
    label: 'Bubble',
    supportsCodeInjection: true,
    supportsAutoPr: false,
    seoSettingsHint: 'Settings → SEO / metatags on each page',
    customCodeHint: 'Settings → SEO → Script/meta tags in header',
    playbookPreamble: 'In the Bubble editor, open page or app settings as described in each step.',
  },
  github_pages: {
    id: 'github_pages',
    label: 'GitHub Pages',
    supportsCodeInjection: true,
    supportsAutoPr: true,
    seoSettingsHint: 'Edit HTML/Markdown source files in the linked repository',
    customCodeHint: 'Add JSON-LD in layout HTML or page front matter',
    playbookPreamble: 'Link your GitHub repo in SynapseCRO for automated PRs, or edit files manually.',
  },
  custom: {
    id: 'custom',
    label: 'Custom / self-hosted',
    supportsCodeInjection: true,
    supportsAutoPr: true,
    seoSettingsHint: 'Edit page HTML or CMS SEO fields',
    customCodeHint: 'Add JSON-LD in the document <head>',
    playbookPreamble: 'Apply changes in your CMS or source files. Link GitHub for automated fix PRs.',
  },
  unknown: {
    id: 'unknown',
    label: 'Unknown platform',
    supportsCodeInjection: false,
    supportsAutoPr: false,
    seoSettingsHint: 'Look for Page settings → SEO, Site settings → SEO, or Marketing → SEO in your builder',
    customCodeHint: 'Look for Custom code, Code injection, or Head scripts in site settings',
    playbookPreamble: 'Open your website builder admin and find SEO or page settings for each item below.',
  },
};

const HOST_PATTERNS: Array<{ pattern: RegExp; id: SitePlatformId }> = [
  { pattern: /\.webflow\.io$|webflow\.com$/i, id: 'webflow' },
  { pattern: /\.wixsite\.com$|\.wix\.com$/i, id: 'wix' },
  { pattern: /\.squarespace\.com$/i, id: 'squarespace' },
  { pattern: /\.myshopify\.com$|\.shopify\.com$/i, id: 'shopify' },
  { pattern: /\.wordpress\.com$|wp\.com$/i, id: 'wordpress' },
  { pattern: /\.framer\.website$|\.framer\.media$|framer\.app$/i, id: 'framer' },
  { pattern: /\.carrd\.co$/i, id: 'carrd' },
  { pattern: /\.bubbleapps\.io$|bubble\.io$/i, id: 'bubble' },
  { pattern: /\.github\.io$/i, id: 'github_pages' },
];

const HTML_PLATFORM_MARKERS: Array<{ pattern: RegExp; id: SitePlatformId }> = [
  { pattern: /webflow\.com|wf-page|data-wf-/i, id: 'webflow' },
  { pattern: /wix\.com|wixstatic|X-Wix-/i, id: 'wix' },
  { pattern: /squarespace\.com|static1\.squarespace/i, id: 'squarespace' },
  { pattern: /cdn\.shopify\.com|Shopify\.theme/i, id: 'shopify' },
  { pattern: /wp-content|wordpress/i, id: 'wordpress' },
  { pattern: /framerusercontent|framer\.com/i, id: 'framer' },
  { pattern: /carrd\.co/i, id: 'carrd' },
];

export function getPlatformInfo(id: SitePlatformId): PlatformInfo {
  return PLATFORMS[id];
}

export function detectPlatformFromUrl(url: string): SitePlatformId {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const { pattern, id } of HOST_PATTERNS) {
      if (pattern.test(hostname)) return id;
    }
  } catch {
    // invalid URL
  }
  return 'unknown';
}

export function detectPlatformFromSeoSignals(signals: SeoSignals[]): SitePlatformId {
  const haystack = signals
    .flatMap((s) => [s.url, s.canonical ?? '', ...(s.jsonLd ?? []).map((j) => JSON.stringify(j))])
    .join('\n');

  for (const { pattern, id } of HTML_PLATFORM_MARKERS) {
    if (pattern.test(haystack)) return id;
  }
  return 'unknown';
}

export function detectSitePlatform(targetUrl: string, pages: Array<{ seo_json: SeoSignals }>): PlatformInfo {
  const fromUrl = detectPlatformFromUrl(targetUrl);
  if (fromUrl !== 'unknown') return getPlatformInfo(fromUrl);

  const fromHtml = detectPlatformFromSeoSignals(pages.map((p) => p.seo_json));
  if (fromHtml !== 'unknown') return getPlatformInfo(fromHtml);

  return getPlatformInfo('unknown');
}

export function isNoCodePlatform(id: SitePlatformId): boolean {
  return id !== 'github_pages' && id !== 'custom' && id !== 'unknown';
}
