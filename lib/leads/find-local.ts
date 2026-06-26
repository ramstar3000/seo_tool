/**
 * Find local-business leads near a location for cold outreach.
 *
 * Sources, in order of trust:
 *   1. OpenStreetMap (Overpass API) — businesses with a contact:email/email tag.
 *   2. The business website (homepage + contact pages) scraped for an address.
 *
 * Each lead is verified at the domain level (MX record) and scored for on-page
 * SEO so callers can rank worst-SEO-first (the best outreach prospects).
 *
 * Server-only: uses node:dns and outbound fetch. Do not import from client code.
 */
import { resolveMx } from 'node:dns/promises';
import * as cheerio from 'cheerio';

export interface LocalLead {
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string | null;
  source: 'osm-tag' | 'website';
  mxValid: boolean;
  seoScore: number;
  seoIssues: string[];
}

export interface FindLocalLeadsParams {
  lat: number;
  lon: number;
  radius?: number; // metres
  target?: number;
}

const UA = 'seo_tool-lead-finder/1.0 (local business research; contact via website)';
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL =
  /(example|sentry|wixpress|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|@2x|@sentry|godaddy|@email\.com$|your@|name@|user@|test@|@domain\.|@mysite\.|@yourdomain|zendesk|@sentry\.io|janedoe|johndoe|@2x\.)/i;
const BAD_DOMAINS =
  /(facebook|instagram|twitter|x\.com|linkedin|google|youtube|tripadvisor|deliveroo|justeat|ubereats|opentable|wix\.com|squarespace|wordpress\.com)/i;
const CHAINS =
  /\b(starbucks|costa|caffe nero|pret|greggs|mcdonald|kfc|burger king|subway|nando|wagamama|pizza express|pizza hut|domino|five guys|leon|itsu|wasabi|gail's|paul\b|patisserie valerie|carluccio|benugo|searcy|laduree|tesco|sainsbury|asda|morrison|waitrose|co-?op|lidl|aldi|m&s|marks ?& ?spencer|boots|superdrug|holland ?& ?barrett|whsmith|wh smith|ryman|poundland|the works|waterstones|hatchard|foyles|wetherspoon|fuller|greene king|young'?s|youngs|nicholson|stonegate|all bar one|the ivy|byron|honest burger|franco manca|zizzi|ask italian|prezzo|bill'?s|the breakfast club|gbk|tortilla|chipotle|chopstix|joe ?& ?the juice|black sheep coffee|grind\b|tim hortons|popeyes|taco bell|barburrito|pure\b|crussh|santander|barclays|hsbc|natwest|lloyds|halifax|nationwide|metro bank|monzo|starling|specsavers|vision express|o2\b|ee\b|vodafone|three\b|carphone|currys|argos|wilko|tk maxx|primark|uniqlo|zara|h&m|h ?& ?m|gap\b|next\b|river island|new look|sports direct|jd sports|foot locker|decathlon)\b/i;
const CORP_INBOX =
  /^(press|media|pr|investor|ir|recruitment|jobs|careers|legal|gdpr|dpo|privacy|complaints|customerservice|customerserviceteam|letters|editorial|newsdesk)@/i;
const ORG_NAME =
  /\b(charity|foundation|\btrust\b|trade union|\bunion\b|\bcouncil\b|association|institute|\bngo\b|art fund|ncvo|quaker|welsh|observatory|federation|the guardian|society of)\b/i;
const ORG_TAG =
  /^(association|ngo|government|political_party|charity|foundation|religion|educational_institution|union|research)$/i;
const GROUP_DOMAINS = /(theivy-collection|autographhotels|laduree)/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normEmail(e: string): string {
  return e.trim().toLowerCase().replace(/^mailto:/, '');
}

function validEmail(e: string): boolean {
  if (!e || BAD_EMAIL.test(e)) return false;
  if (CORP_INBOX.test(e)) return false;
  const domain = e.split('@')[1] || '';
  if (BAD_DOMAINS.test(domain) || GROUP_DOMAINS.test(domain)) return false;
  if (domain.length < 4 || !domain.includes('.')) return false;
  return true;
}

// --- email verification: does the domain accept mail? (MX record) -------
const mxCache = new Map<string, boolean>();
async function hasMx(email: string): Promise<boolean> {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return false;
  const cached = mxCache.get(domain);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    const records = await resolveMx(domain);
    ok = Array.isArray(records) && records.length > 0;
  } catch {
    ok = false;
  }
  mxCache.set(domain, ok);
  return ok;
}

function cleanUrl(u: string | null | undefined): URL | null {
  if (!u) return null;
  try {
    let s = u.trim();
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const url = new URL(s);
    if (BAD_DOMAINS.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function getHtml(url: string, timeoutMs = 9000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function emailsFromHtml(html: string): string[] {
  const found = new Set<string>();
  const $ = cheerio.load(html);
  $('a[href^="mailto:"]').each((_, el) => {
    const e = normEmail(($(el).attr('href') || '').split('?')[0].replace('mailto:', ''));
    if (validEmail(e)) found.add(e);
  });
  const text = $('body').text() + ' ' + html;
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = normEmail(m[0]);
    if (validEmail(e)) found.add(e);
  }
  return [...found];
}

async function scrapeEmail(websiteUrl: string): Promise<string | null> {
  const base = cleanUrl(websiteUrl);
  if (!base) return null;
  const candidates = [
    base.href,
    new URL('/contact', base).href,
    new URL('/contact-us', base).href,
    new URL('/about', base).href,
  ];
  for (const c of candidates) {
    const html = await getHtml(c);
    if (!html) continue;
    const emails = emailsFromHtml(html);
    if (emails.length) {
      const host = base.hostname.replace(/^www\./, '');
      const onDomain = emails.find(
        (e) => e.split('@')[1].includes(host) || host.includes(e.split('@')[1].split('.')[0])
      );
      return onDomain || emails[0];
    }
    await sleep(150);
  }
  return null;
}

// --- lightweight on-page SEO score (higher = worse = better prospect) ---
function scoreSeo(html: string, finalUrl: string): { score: number; issues: string[] } {
  const $ = cheerio.load(html);
  const issues: string[] = [];
  const title = ($('title').first().text() || '').trim();
  if (!title) issues.push('no title tag');
  else if (title.length < 15 || title.length > 65) issues.push('poor title length');
  if (!$('meta[name="description"]').attr('content')?.trim()) issues.push('no meta description');
  if ($('h1').length === 0) issues.push('no H1');
  else if ($('h1').length > 1) issues.push('multiple H1s');
  if (!$('meta[property="og:title"]').length) issues.push('no Open Graph tags');
  if (!$('meta[name="viewport"]').length) issues.push('not mobile-friendly (no viewport)');
  if (!$('link[rel="canonical"]').length) issues.push('no canonical URL');
  if (!/^https:/i.test(finalUrl || '')) issues.push('not on HTTPS');
  const imgs = $('img');
  const noAlt = imgs.filter((_, el) => !($(el).attr('alt') || '').trim()).length;
  if (imgs.length > 3 && noAlt / imgs.length > 0.5) issues.push('images missing alt text');
  if (!$('script[type="application/ld+json"]').length) issues.push('no structured data');
  return { score: issues.length, issues };
}

interface OverpassElement {
  tags?: Record<string, string>;
}

async function fetchBusinesses(lat: number, lon: number, radius: number): Promise<OverpassElement[]> {
  const q = `
    [out:json][timeout:60];
    (
      nwr(around:${radius},${lat},${lon})[shop][name];
      nwr(around:${radius},${lat},${lon})[amenity~"^(cafe|restaurant|bar|pub|pharmacy|dentist|clinic|veterinary|gym|fitness_centre|hairdresser|estate_agent|coworking_space)$"][name];
      nwr(around:${radius},${lat},${lon})[office][name];
      nwr(around:${radius},${lat},${lon})[craft][name];
    );
    out tags center;
  `;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastErr: unknown;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return json.elements || [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Overpass query failed: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function findLocalLeads(params: FindLocalLeadsParams): Promise<LocalLead[]> {
  const { lat, lon } = params;
  const radius = params.radius ?? 700;
  const target = params.target ?? 50;
  const CONCURRENCY = 6;

  const elements = await fetchBusinesses(lat, lon, radius);

  // de-dupe + filter out chains / orgs
  const seen = new Set<string>();
  const businesses: {
    name: string;
    category: string;
    website: string | null;
    tagEmail: string | null;
    phone: string;
  }[] = [];
  for (const el of elements) {
    const t = el.tags || {};
    const name = t.name;
    if (!name) continue;
    if (t.brand || t['brand:wikidata'] || CHAINS.test(name)) continue;
    if (ORG_NAME.test(name)) continue;
    if (t.office && ORG_TAG.test(t.office)) continue;
    if (t.amenity && /^(place_of_worship|social_facility|community_centre|townhall|courthouse)$/.test(t.amenity)) continue;
    const website = t.website || t['contact:website'] || t.url || null;
    const tagEmail = normEmail(t['contact:email'] || t.email || '');
    const key = (name + '|' + (website || '')).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    businesses.push({
      name,
      category: t.shop || t.amenity || t.office || t.craft || '',
      website,
      tagEmail: validEmail(tagEmail) ? tagEmail : null,
      phone: t.phone || t['contact:phone'] || '',
    });
  }

  // Oversample so MX-filtering + ranking still leaves `target` leads.
  const oversample = Math.ceil(target * 1.8);
  type Partial = (typeof businesses)[number] & { email: string; source: LocalLead['source'] };
  const collected: Partial[] = [];
  const haveEmail = (e: string) => collected.some((l) => l.email === e);

  // 1) OSM-tagged emails first (free).
  for (const b of businesses) {
    if (collected.length >= oversample) break;
    if (b.tagEmail && !haveEmail(b.tagEmail)) {
      collected.push({ ...b, email: b.tagEmail, source: 'osm-tag' });
    }
  }

  // 2) Scrape websites for the rest.
  const toScrape = businesses.filter((b) => !b.tagEmail && b.website);
  let si = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (si < toScrape.length && collected.length < oversample) {
        const b = toScrape[si++];
        const email = await scrapeEmail(b.website as string);
        if (email && validEmail(email) && !haveEmail(email)) {
          collected.push({ ...b, email, source: 'website' });
        }
      }
    })
  );

  // 3) Enrich: MX + SEO score.
  const enriched = await mapWithConcurrency(collected, CONCURRENCY, async (l): Promise<LocalLead> => {
    const mxValid = await hasMx(l.email);
    let seoScore: number | undefined;
    let seoIssues: string[] | undefined;
    if (l.website) {
      const base = cleanUrl(l.website);
      const html = base ? await getHtml(base.href) : null;
      if (html && base) {
        const s = scoreSeo(html, base.href);
        seoScore = s.score;
        seoIssues = s.issues;
      }
    }
    if (seoScore === undefined) {
      seoScore = l.website ? 5 : 6;
      seoIssues = l.website ? ['site unreachable'] : ['no website'];
    }
    return {
      name: l.name,
      category: l.category,
      email: l.email,
      phone: l.phone,
      website: l.website,
      source: l.source,
      mxValid,
      seoScore,
      seoIssues: seoIssues ?? [],
    };
  });

  // 4) Keep deliverable domains, rank worst-SEO first, trim.
  return enriched
    .filter((l) => l.mxValid)
    .sort((a, b) => b.seoScore - a.seoScore)
    .slice(0, target);
}

// --- outreach draft generation ------------------------------------------
export interface DraftOptions {
  sender: string;
  tool: string;
  url: string;
  calendar?: string;
  place?: string;
}

const HOOKS: [string, string][] = [
  ['no title tag', "your homepage is missing its page title — that's the headline Google shows in search results, so right now it has nothing to display"],
  ['no meta description', "there's no meta description on your site, so Google is auto-guessing the grey summary text under your listing instead of you controlling it"],
  ['no H1', 'your homepage has no main heading (H1), which is one of the first things search engines read to understand what you do'],
  ['poor title length', "your page title is getting cut off in search results, so people don't see your full name/offer before clicking"],
  ['not on HTTPS', 'your site isn\'t on HTTPS — browsers flag that as "Not secure", which scares off visitors and hurts ranking'],
  ['not mobile-friendly', 'your site is missing the mobile viewport setting, so it likely renders badly on phones (where most local searches happen)'],
  ['multiple H1s', 'your homepage has several competing main headings, which muddies what Google thinks the page is about'],
  ['no Open Graph', 'when someone shares your site on WhatsApp/Instagram, there\'s no preview image or title set up, so the link looks broken'],
  ['no structured data', "you're missing structured data, so you're not eligible for the rich results (stars, hours, menu) that make listings stand out"],
  ['images missing alt text', "a lot of your images have no alt text — that's missed ranking signal and an accessibility gap"],
  ['no canonical', 'your pages have no canonical tag, which can split your ranking across duplicate URLs'],
];

function hookFor(issues: string[]): string {
  const s = issues.join('; ').toLowerCase();
  for (const [key, line] of HOOKS) if (s.includes(key)) return line;
  return 'a few quick on-page SEO fixes could help you show up more in local search';
}

export function buildDraft(lead: LocalLead, opts: DraftOptions): { subject: string; body: string } {
  const hook = hookFor(lead.seoIssues);
  const place = opts.place || 'your area';
  const subject = `Quick SEO note about ${lead.name}`;
  const calendarClause = opts.calendar ? ` (${opts.calendar})` : '';
  const body = `Hi ${lead.name} team,

I was looking at ${place} businesses online and noticed something on your site: ${hook}.

It's a quick fix, and for a local spot like yours it can make a real difference in how many people find you on Google. I run ${opts.tool} (${opts.url}) — it scans a site, lists exactly what's holding it back, and shows how to fix each one.

Want me to send over a free, no-strings audit of ${lead.name}? If it's useful we can chat${calendarClause}; if not, no worries at all.

Cheers,
${opts.sender}

—
Sent because ${lead.name} is a ${place} business with a public contact address. Not interested? Reply "unsubscribe" and I won't email again.`;
  return { subject, body };
}
