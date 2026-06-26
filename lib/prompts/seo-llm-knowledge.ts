/**
 * Distilled SEO + LLM discoverability rubric for agent prompts.
 * Classifies site type FIRST so local, personal, and global sites get different advice.
 */

export type SeoSiteType = 'local_service' | 'personal' | 'global_brand' | 'unknown';

/** Step 0 — classify before applying local/global/personal tactics. */
export const SEO_SITE_TYPE_CLASSIFICATION = `
Site-type classification (do this FIRST from URL, copy, nav, and schema — do not assume every audit is a local shop):
- local_service — trades, clinics, restaurants, salons, solicitors, etc. serving a geographic area; NAP, GBP, service+area keywords, LocalBusiness schema apply.
- personal — portfolio, resume, blog, creator site, consultant personal brand; use Person/WebSite schema, authorship, projects — NOT GBP, borough landing pages, or "call now" CRO unless the site actually sells local services.
- global_brand — SaaS, app, ecommerce, enterprise, media; use Organization/Product/WebApplication schema, product-led messaging, international SEO — NOT hyper-local Map Pack or single-borough URLs.
- unknown — classify from homepage scrape before recommending; say "appears to be …" in findings.

Signals:
- local: address/phone in footer, "serving {area}", service area pages, Dentist/Plumber/etc. schema, booking CTAs
- personal: first-person bio, /about-me, project gallery, no commercial NAP, Person schema or none
- global: pricing/docs/login, multi-locale, careers, press kit, Organization + Product schema, .com app subdomain

If lead context says "London plumber" but the site is clearly a personal blog or global SaaS, trust the site — reclassify and skip irrelevant local checks (GBP, Yelp, borough pages). Mention the mismatch as info if keyword intent doesn't fit the site.`;

/** Universal foundations — all site types. */
export const SEO_LLM_UNIVERSAL_RUBRIC = `
Universal SEO + LLM discoverability (all site types):
- LLM search uses RAG over indexed content. Fix Google/Bing indexability first (robots, sitemap, no accidental noindex, fast TTFB, meaningful HTML without JS-only shells).
- On-page: one clear H1; logical H2/H3; bullets over walls of text; unique title + meta aligned with H1; opening paragraph that standalone-summarizes the page topic (RAG anchor).
- When saving findings: cite scraped evidence. Prefer fixes that help snippets AND LLM citation. Never keyword stuffing.`;

/** Type-specific addenda — only apply after classification. */
export const SEO_LLM_BY_SITE_TYPE = `
Type-specific checks (apply ONLY when classification matches):
- local_service: NAP consistency, GBP/social/directory presence, service+area pages, LocalBusiness subtype schema, Map Pack CRO (phone/book above fold), local keyword in title/H1.
- personal: Person or ProfilePage schema; clear about/bio; project/work samples; canonical author identity; internal links between posts/projects — skip GBP, Yelp, and "service area" landing page advice.
- global_brand: Organization/Product/WebApplication schema; product value prop above fold; docs/pricing clarity; hreflang if multi-region; competitor positioning — skip borough URLs and local directory citations unless they have physical locations.`;

/** Prioritized fixes — branch by inferred site type. */
export const SEO_LLM_EDIT_PRIORITIES = `
Apply fixes in this order (match schema and copy to the site's type — do not force LocalBusiness on personal or global sites):
1. Indexability — noindex, title, meta, canonical
2. Entity + summary — opening paragraph, H1, appropriate JSON-LD:
   - local_service → LocalBusiness subtype + NAP
   - personal → Person + WebSite/WebPage
   - global_brand → Organization + Product/SoftwareApplication as accurate
3. Semantic structure — headings, FAQ schema only if FAQs exist, alt text
4. Internal links — related pages (services/areas vs posts/projects vs product/docs)
5. LLM extras — top-of-page summary, optional llms.txt
Prefer surgical edits. Never add fake addresses, borough pages, or GBP CTAs to non-local sites.`;

export const SEO_LLM_SYNTHESIS_HINT = `
Tailor MUST_DO to the classified site type and owner (local owner vs individual creator vs product team). Do not recommend GBP, Yelp, or borough landing pages for personal portfolios or global SaaS. At least one MUST_DO should improve discoverability (summary, schema, structure, or indexability) when evidence supports it.`;

export const SEO_LLM_SCRAPE_CHECKS = `
From scraped HTML, check (then classify site type):
- title, meta description, canonical, robots
- H1 count (expect 1), H2/H3 hierarchy
- jsonLd types present (LocalBusiness vs Person vs Organization vs none)
- opening copy: local = "who/where/service"; personal = "who/credibility/work"; global = "what product/problem solved"
- footer signals: street address + phone (local) vs social links only (personal) vs legal/careers/docs nav (global)
- thin body may indicate JS-rendered shell`;

export const SEO_LLM_AUDIT_RUBRIC = [
  SEO_SITE_TYPE_CLASSIFICATION,
  SEO_LLM_UNIVERSAL_RUBRIC,
  SEO_LLM_BY_SITE_TYPE,
].join('\n');

export function buildSeoLlmPromptBlock(mode: 'audit' | 'edit' | 'synthesize'): string {
  switch (mode) {
    case 'audit':
      return `${SEO_LLM_AUDIT_RUBRIC}\n${SEO_LLM_SCRAPE_CHECKS}`;
    case 'edit':
      return SEO_LLM_EDIT_PRIORITIES;
    case 'synthesize':
      return SEO_LLM_SYNTHESIS_HINT;
  }
}

/** Optional hint when lead pipeline provides local context but site may differ. */
export function buildSiteContextHint(params: {
  businessName: string;
  keyword: string;
  location?: string;
}): string {
  const { businessName, keyword, location = 'London' } = params;
  return `Lead context (hypothesis — verify against the live site): "${businessName}" targeting "${keyword}" in ${location}. If the site is personal or global, reclassify and audit accordingly; do not force local-business recommendations.`;
}
