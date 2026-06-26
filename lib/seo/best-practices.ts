import type { Lead } from '@/lib/leads/types';

export type SeoPracticePriority = 'high' | 'medium';

export type SeoPracticeCategory =
  | 'Local SEO'
  | 'On-page'
  | 'CRO overlap'
  | 'Technical SEO'
  | 'Content'
  | 'LLM discoverability';

export interface SeoBestPractice {
  id: string;
  category: SeoPracticeCategory;
  title: string;
  description: string;
  priority: SeoPracticePriority;
  appliesTo: string[];
  source: string;
}

export const SEO_PRACTICE_CATEGORIES: SeoPracticeCategory[] = [
  'Local SEO',
  'On-page',
  'CRO overlap',
  'Technical SEO',
  'Content',
  'LLM discoverability',
];

export interface LeadRecommendationInput {
  category?: string | null;
  rank_position: 3 | 4;
  website_url?: string | null;
  recommendation?: string | null;
  location?: string;
  keyword?: string;
}

export interface LeadRecommendations {
  practices: SeoBestPractice[];
  topPractices: SeoBestPractice[];
  combinedText: string;
}

const YMYL_CATEGORIES = new Set(['dentist', 'solicitor', 'accountant', 'physio', 'optician']);
const LOCAL_SERVICE_CATEGORIES = new Set([
  'plumber',
  'electrician',
  'dentist',
  'physio',
  'gym',
  'restaurant',
  'cafe',
  'pub',
  'solicitor',
  'accountant',
  'beauty',
  'cleaning',
  'roofer',
  'tutoring',
  'auto',
  'estate agent',
  'optician',
]);

export const SEO_BEST_PRACTICES: SeoBestPractice[] = [
  {
    id: 'gbp-complete-verified',
    category: 'Local SEO',
    title: 'Complete and verify Google Business Profile',
    description:
      'Fill every GBP field — primary category, address, phone, hours, services, and description. Verify ownership so Google trusts you represent the business.',
    priority: 'high',
    appliesTo: ['*'],
    source: 'Google Business Profile Help',
  },
  {
    id: 'gbp-categories',
    category: 'Local SEO',
    title: 'Use the most specific primary GBP category',
    description:
      'Pick the narrowest primary category (e.g. "Plumber" not "Contractor") and add relevant secondary categories. Categories are major filters in local search.',
    priority: 'high',
    appliesTo: ['*'],
    source: 'Google Business Profile Help',
  },
  {
    id: 'nap-consistency',
    category: 'Local SEO',
    title: 'Keep NAP identical everywhere',
    description:
      'Match name, address, and phone exactly across GBP, website footer, JSON-LD, Yelp, Apple Business Connect, and Bing Places.',
    priority: 'high',
    appliesTo: ['*'],
    source: 'Google Search Central — LocalBusiness schema',
  },
  {
    id: 'local-business-schema',
    category: 'Local SEO',
    title: 'Add LocalBusiness JSON-LD on key pages',
    description:
      'Use the most specific schema subtype (Restaurant, Dentist, LegalService). Place markup on homepage, contact, and location pages with NAP, hours, and geo coordinates.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Search Central',
  },
  {
    id: 'gbp-reviews-steady',
    category: 'Local SEO',
    title: 'Build Google reviews steadily',
    description:
      'Share a direct GBP review link. Aim for a consistent trickle (2–5 per week) rather than bulk bursts — review velocity is a Map Pack prominence signal.',
    priority: 'high',
    appliesTo: ['*'],
    source: 'Google Business Profile Help; Search Engine Land',
  },
  {
    id: 'respond-to-reviews',
    category: 'Local SEO',
    title: 'Reply to every review within 72 hours',
    description:
      'Respond professionally to positive and negative reviews. Keep replies short, acknowledge issues offline for complaints, and never keyword-stuff responses.',
    priority: 'medium',
    appliesTo: ['*'],
    source: 'Google Business Profile Help',
  },
  {
    id: 'citation-directories',
    category: 'Local SEO',
    title: 'Sync top citation directories',
    description:
      'After GBP and your website, align Yelp, Apple Business Connect, and Bing Places — these cover most citation weight for UK local businesses.',
    priority: 'medium',
    appliesTo: ['*'],
    source: 'Google Search Central',
  },
  {
    id: 'no-website-gbp-first',
    category: 'Local SEO',
    title: 'Launch GBP-first when no website exists',
    description:
      'Without a site, GBP is your digital storefront. Complete every field, collect reviews, add photos, and post updates until a one-page site is ready.',
    priority: 'high',
    appliesTo: ['no-website'],
    source: 'Google Business Profile Help',
  },
  {
    id: 'title-tags',
    category: 'On-page',
    title: 'Write unique title tags (50–60 characters)',
    description:
      'Lead with service + borough (e.g. "Plumber Camden | 24hr Emergency"). Keep titles unique, aligned with the H1, and under ~60 characters.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Moz; Semrush',
  },
  {
    id: 'meta-descriptions',
    category: 'On-page',
    title: 'Craft meta descriptions (~105 characters)',
    description:
      'Summarise page value in active voice, include the target keyword, and add a soft CTA. Stay concise to avoid mobile snippet truncation.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'Semrush on-page checklist',
  },
  {
    id: 'single-h1',
    category: 'On-page',
    title: 'Use one descriptive H1 per page',
    description:
      'Each page needs exactly one H1 stating the main topic. Match search intent, include the primary keyword, and nest H2/H3 subtopics beneath.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Moz; Search Engine Land',
  },
  {
    id: 'internal-linking',
    category: 'On-page',
    title: 'Link internally with descriptive anchor text',
    description:
      'Use a hub-and-spoke model linking service pillars to FAQs and borough landing pages. Avoid orphan pages and keyword-stuffed anchor text.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'Semrush; Search Engine Land',
  },
  {
    id: 'service-area-urls',
    category: 'On-page',
    title: 'Target service + borough keywords in URLs',
    description:
      'Create focused URLs like /plumber-camden with matching H1 and title. Pair the trade with the neighbourhood rather than generic "London" pages.',
    priority: 'high',
    appliesTo: ['has-website', 'local-service'],
    source: 'Semrush local SEO guidance',
  },
  {
    id: 'rank4-long-tail',
    category: 'On-page',
    title: 'Target long-tail queries at rank 4',
    description:
      'At position 4, prioritise specific service + area pages and niche keywords rather than only the head local term you already nearly rank for.',
    priority: 'high',
    appliesTo: ['rank-4'],
    source: 'SynapseCRO lead model',
  },
  {
    id: 'cta-above-fold',
    category: 'CRO overlap',
    title: 'Place primary CTA above the fold',
    description:
      'Phone, booking, or quote buttons must be visible without scrolling on mobile. Rank 3–4 listings lose clicks when CTAs sit below the fold.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Core Web Vitals; CRO research',
  },
  {
    id: 'repeat-ctas',
    category: 'CRO overlap',
    title: 'Repeat CTAs at decision points',
    description:
      'After testimonials, service details, and case studies, repeat the same primary action. Long pages should end with a clear next step.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'Semrush CRO guidance',
  },
  {
    id: 'mobile-first',
    category: 'CRO overlap',
    title: 'Design mobile-first for conversion',
    description:
      'Google ranks the mobile version. Use min 44×44px tap targets, readable headlines, and a visible CTA on the first screen.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Search Central; web.dev',
  },
  {
    id: 'trust-signals',
    category: 'CRO overlap',
    title: 'Show trust signals near CTAs',
    description:
      'Display star ratings, review counts, accreditations (Gas Safe, CQC, SRA), and response-time promises adjacent to forms — not in the footer.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Search Engine Land',
  },
  {
    id: 'page-speed-cro',
    category: 'CRO overlap',
    title: 'Treat page speed as a conversion lever',
    description:
      'Compress images (WebP), lazy-load below-fold media, and remove heavy scripts. Good Core Web Vitals correlate with higher conversion rates.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'web.dev; PageSpeed Insights',
  },
  {
    id: 'online-booking',
    category: 'CRO overlap',
    title: 'Embed online booking above the fold',
    description:
      'Integrate booking (Fresha, Calendly, OpenTable) near the top of service pages to reduce friction vs competitors in the Map Pack.',
    priority: 'high',
    appliesTo: ['beauty', 'dentist', 'restaurant', 'physio', 'accountant'],
    source: 'Local CRO best practice',
  },
  {
    id: 'rank3-conversion-push',
    category: 'CRO overlap',
    title: 'Prioritise conversion fixes for rank-3 leads',
    description:
      'Businesses at position 3 are one push from the top — focus on headline clarity, above-fold CTA, and trust signals before net-new content.',
    priority: 'high',
    appliesTo: ['rank-3', 'has-website'],
    source: 'SynapseCRO lead model',
  },
  {
    id: 'cwv-lcp',
    category: 'Technical SEO',
    title: 'Target LCP under 2.5 seconds',
    description:
      'Preload hero images, use a CDN, and reduce server response time. LCP is a confirmed ranking and UX signal for competitive local keywords.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'web.dev Core Web Vitals',
  },
  {
    id: 'cwv-inp',
    category: 'Technical SEO',
    title: 'Keep INP under 200 ms',
    description:
      'Break up long JavaScript tasks and defer non-critical scripts. INP replaced FID in 2024 and measures responsiveness across all interactions.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'web.dev — Optimize INP',
  },
  {
    id: 'cwv-cls',
    category: 'Technical SEO',
    title: 'Stabilise layout (CLS under 0.1)',
    description:
      'Set explicit dimensions on images and embeds, reserve space for dynamic content, and avoid injecting elements above existing UI.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'web.dev Core Web Vitals',
  },
  {
    id: 'xml-sitemap',
    category: 'Technical SEO',
    title: 'Maintain a clean XML sitemap',
    description:
      'Include only canonical, indexable URLs. Submit in Search Console, reference in robots.txt, and update lastmod when content actually changes.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Search Central',
  },
  {
    id: 'structured-data-validate',
    category: 'Technical SEO',
    title: 'Validate structured data regularly',
    description:
      'Run JSON-LD through Rich Results Test and monitor Search Console. Fix missing properties on LocalBusiness, FAQPage, and BreadcrumbList markup.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Search Central',
  },
  {
    id: 'structured-data-vertical',
    category: 'Technical SEO',
    title: 'Use schema types that match your vertical',
    description:
      'Apply Restaurant, Dentist, LegalService, RealEstateAgent, or other specific subtypes rather than generic LocalBusiness where possible.',
    priority: 'high',
    appliesTo: ['restaurant', 'cafe', 'pub', 'dentist', 'solicitor', 'estate agent', 'optician'],
    source: 'Google Search Central',
  },
  {
    id: 'rank4-foundations',
    category: 'Technical SEO',
    title: 'Fix foundational SEO at rank 4',
    description:
      'Rank-4 businesses often lack verified GBP, NAP consistency, mobile speed, and a strong service page. Address basics before advanced tactics.',
    priority: 'high',
    appliesTo: ['rank-4'],
    source: 'SynapseCRO lead model',
  },
  {
    id: 'local-landing-pages',
    category: 'Content',
    title: 'Build unique borough landing pages',
    description:
      'One page per service + area (e.g. "Electrician Islington") with 40–60% unique content: local testimonials, landmarks, and area-specific FAQs.',
    priority: 'high',
    appliesTo: ['local-service', 'no-website', 'has-website'],
    source: 'Google doorway pages guidance',
  },
  {
    id: 'eeat-trust',
    category: 'Content',
    title: 'Demonstrate E-E-A-T on site and GBP',
    description:
      'Show staff bios with credentials, case studies with outcomes, and original job-site photos. Essential for YMYL trades in London.',
    priority: 'high',
    appliesTo: ['has-website', 'ymyl'],
    source: 'Google Search Quality Rater Guidelines',
  },
  {
    id: 'neighbourhood-content',
    category: 'Content',
    title: 'Reference local landmarks and neighbourhoods',
    description:
      'Mention nearby stations, high streets, and borough context naturally. Hyper-local relevance helps match "[service] [area]" queries.',
    priority: 'medium',
    appliesTo: ['local-service'],
    source: 'Local SEO neighbourhood targeting',
  },
  {
    id: 'faq-content',
    category: 'Content',
    title: 'Publish FAQs from real customer questions',
    description:
      'Answer pricing, response times, and service-area questions on-page. Add FAQPage schema where appropriate to capture snippet space.',
    priority: 'medium',
    appliesTo: ['has-website', 'local-service'],
    source: 'Semrush; Google structured data docs',
  },
  {
    id: 'ssr-visible-html',
    category: 'LLM discoverability',
    title: 'Serve meaningful HTML without JavaScript',
    description:
      'AI crawlers often skip JS execution. Use SSR/SSG so title, H1, and body copy appear in curl / view-source — CSR-only shells are partially invisible to LLMs.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'LLM SEO / Vercel AI crawler research',
  },
  {
    id: 'opening-summary-rag',
    category: 'LLM discoverability',
    title: 'Lead with a standalone opening summary',
    description:
      'First paragraph should summarize the page in 2–3 sentences: local = who/where/service; personal = who/expertise; global = product/problem solved. Acts as an RAG embedding anchor.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'LLM SEO (RAG retrieval best practice)',
  },
  {
    id: 'semantic-html-structure',
    category: 'LLM discoverability',
    title: 'Use semantic heading hierarchy and scannable layout',
    description:
      'One H1, nested H2/H3, bullet lists over text walls. Clear structure improves semantic similarity matching in AI search — not just traditional rankings.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'LLM SEO',
  },
  {
    id: 'llms-txt',
    category: 'LLM discoverability',
    title: 'Add llms.txt at the site root (optional)',
    description:
      'Emerging convention to document AI usage preferences (similar spirit to robots.txt). Low effort, no SEO downside — signals transparency to AI systems.',
    priority: 'medium',
    appliesTo: ['has-website'],
    source: 'llms.txt proposal',
  },
  {
    id: 'index-before-llm',
    category: 'LLM discoverability',
    title: 'Fix Google/Bing indexability before LLM tactics',
    description:
      'LLM search retrieves from indexed web content. Valid sitemap, robots.txt, and Search Console coverage are prerequisites — LLM SEO builds on traditional SEO.',
    priority: 'high',
    appliesTo: ['has-website'],
    source: 'Google Search Central; LLM SEO',
  },
];

function buildLeadTags(lead: LeadRecommendationInput): Set<string> {
  const tags = new Set<string>(['*']);

  if (lead.website_url) tags.add('has-website');
  else tags.add('no-website');

  tags.add(`rank-${lead.rank_position}`);

  if (lead.category) {
    tags.add(lead.category);
    if (YMYL_CATEGORIES.has(lead.category)) tags.add('ymyl');
    if (LOCAL_SERVICE_CATEGORIES.has(lead.category)) tags.add('local-service');
  }

  return tags;
}

function practiceApplies(practice: SeoBestPractice, lead: LeadRecommendationInput): boolean {
  const tags = buildLeadTags(lead);
  return practice.appliesTo.some((tag) => tags.has(tag));
}

function practiceScore(practice: SeoBestPractice, lead: LeadRecommendationInput): number {
  const tags = buildLeadTags(lead);
  let score = practice.priority === 'high' ? 2 : 1;

  for (const tag of practice.appliesTo) {
    if (tag !== '*' && tags.has(tag)) score += 3;
  }

  return score;
}

export function getMatchingPractices(
  lead: LeadRecommendationInput,
  limit = 3
): SeoBestPractice[] {
  return SEO_BEST_PRACTICES.filter((p) => practiceApplies(p, lead))
    .sort((a, b) => practiceScore(b, lead) - practiceScore(a, lead))
    .slice(0, limit);
}

export function getRecommendationsForLead(lead: LeadRecommendationInput): string {
  const practices = getMatchingPractices(lead, 3);
  const practiceLines = practices.map((p) => `• ${p.title}: ${p.description}`);
  const parts: string[] = [];

  if (lead.recommendation?.trim()) {
    parts.push(lead.recommendation.trim());
  }

  if (practiceLines.length > 0) {
    parts.push(`SEO best practices:\n${practiceLines.join('\n')}`);
  }

  return parts.join('\n\n');
}

export function getRecommendationsForLeadRecord(lead: Lead): LeadRecommendations {
  const practices = SEO_BEST_PRACTICES.filter((p) =>
    practiceApplies(p, {
      category: lead.category,
      rank_position: lead.rank_position,
      website_url: lead.website_url,
      recommendation: lead.recommendation,
      location: lead.location,
      keyword: lead.keyword,
    })
  ).sort(
    (a, b) =>
      practiceScore(b, {
        category: lead.category,
        rank_position: lead.rank_position,
        website_url: lead.website_url,
      }) -
      practiceScore(a, {
        category: lead.category,
        rank_position: lead.rank_position,
        website_url: lead.website_url,
      })
  );

  const topPractices = practices.slice(0, 3);
  const combinedText = getRecommendationsForLead({
    category: lead.category,
    rank_position: lead.rank_position,
    website_url: lead.website_url,
    recommendation: lead.recommendation,
    location: lead.location,
    keyword: lead.keyword,
  });

  return { practices, topPractices, combinedText };
}

export function getPracticeCategories(): string[] {
  return [...SEO_PRACTICE_CATEGORIES];
}

export function getPracticesByCategory(): Record<SeoPracticeCategory, SeoBestPractice[]> {
  const grouped = Object.fromEntries(
    SEO_PRACTICE_CATEGORIES.map((cat) => [cat, [] as SeoBestPractice[]])
  ) as Record<SeoPracticeCategory, SeoBestPractice[]>;

  for (const practice of SEO_BEST_PRACTICES) {
    grouped[practice.category].push(practice);
  }

  return grouped;
}
