#!/usr/bin/env node
/**
 * Find local-business leads near a location for cold outreach.
 *
 * Sources, in order of trust:
 *   1. OpenStreetMap (Overpass API) — businesses with a `contact:email`/`email` tag (free, no key).
 *   2. The business website (homepage + common contact pages) scraped for email addresses.
 *
 * Usage:
 *   node scripts/find-leads.mjs            # defaults: Kings Cross, London, ~50 leads
 *   node scripts/find-leads.mjs --lat 51.5308 --lon -0.1238 --radius 700 --target 50
 *
 * Output: scripts/out/leads-<timestamp>.csv  (+ printed summary)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMx } from 'node:dns/promises';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'out');

// --- args ---------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};
const LAT = parseFloat(arg('lat', '51.5308')); // Kings Cross station
const LON = parseFloat(arg('lon', '-0.1238'));
const RADIUS = parseInt(arg('radius', '700'), 10); // metres
const TARGET = parseInt(arg('target', '50'), 10);

const UA = 'seo_tool-lead-finder/1.0 (local business research; contact via website)';
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// junk we never want to email
const BAD_EMAIL = /(example|sentry|wixpress|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|@2x|@sentry|godaddy|@email\.com$|your@|name@|user@|test@|@domain\.|@mysite\.|@yourdomain|zendesk|@sentry\.io|janedoe|johndoe|@2x\.)/i;
const BAD_DOMAINS = /(facebook|instagram|twitter|x\.com|linkedin|google|youtube|tripadvisor|deliveroo|justeat|ubereats|opentable|wix\.com|squarespace|wordpress\.com)/i;

// Known chains / big corps to exclude — we want independent boutiques only.
const CHAINS = /\b(starbucks|costa|caffe nero|pret|greggs|mcdonald|kfc|burger king|subway|nando|wagamama|pizza express|pizza hut|domino|five guys|leon|itsu|wasabi|eat\b|gail's|paul\b|patisserie valerie|carluccio|benugo|searcy|laduree|tesco|sainsbury|asda|morrison|waitrose|co-?op|lidl|aldi|m&s|marks ?& ?spencer|boots|superdrug|holland ?& ?barrett|whsmith|wh smith|ryman|rymans|poundland|the works|waterstones|hatchard|foyles|carluccios|wetherspoon|fuller|greene king|young'?s|youngs|nicholson|metropolitan pub|stonegate|all bar one|slug ?& ?lettuce|the ivy|côte|cote\b|byron|honest burger|franco manca|zizzi|ask italian|prezzo|bill'?s|the breakfast club|gourmet burger|gbk|tortilla|chipotle|chopstix|wok to walk|joe ?& ?the juice|black sheep coffee|grind\b|notes\b|department of coffee|tim hortons|popeyes|taco bell|five guys|barburrito|pure\b|chop'?d|abokado|crussh|filmore|natural kitchen|vital ingredient|the post office|post office|santander|barclays|hsbc|natwest|lloyds|halifax|nationwide|metro bank|monzo|starling|specsavers|vision express|boots opticians|o2\b|ee\b|vodafone|three\b|carphone|currys|argos|wilko|tk maxx|primark|uniqlo|zara|h&m|h ?& ?m|gap\b|next\b|river island|new look|sports direct|jd sports|footlocker|foot locker|decathlon|the guardian|starbucks)\b/i;
// Corporate / non-prospect inboxes we don't want to cold-pitch.
const CORP_INBOX = /^(press|media|pr|investor|ir|recruitment|jobs|careers|legal|gdpr|dpo|privacy|complaints|customerservice|customerserviceteam|letters|editorial|newsdesk)@/i;

// Orgs / charities / unions / institutions — not boutique-business prospects.
const ORG_NAME = /\b(charity|foundation|\btrust\b|trade union|\bunion\b|\bcouncil\b|association|institute|\bngo\b|art fund|ncvo|quaker|welsh|observatory|federation|the guardian|society of)\b/i;
const ORG_TAG = /^(association|ngo|government|political_party|charity|foundation|religion|educational_institution|union|research)$/i;
// Specific domains that belong to chains/groups (caught by domain, not name).
const GROUP_DOMAINS = /(theivy-collection|autographhotels|laduree)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normEmail(e) {
  return e.trim().toLowerCase().replace(/^mailto:/, '');
}

function validEmail(e) {
  if (!e || BAD_EMAIL.test(e)) return false;
  if (CORP_INBOX.test(e)) return false;
  const domain = e.split('@')[1] || '';
  if (BAD_DOMAINS.test(domain) || GROUP_DOMAINS.test(domain)) return false;
  if (domain.length < 4 || !domain.includes('.')) return false;
  return true;
}

// --- email verification: does the domain accept mail? (MX record) -------
const mxCache = new Map();
async function hasMx(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain);
  let ok = false;
  try {
    const records = await resolveMx(domain);
    ok = Array.isArray(records) && records.length > 0;
  } catch {
    ok = false; // NXDOMAIN / no MX → can't receive mail
  }
  mxCache.set(domain, ok);
  return ok;
}

// --- lightweight on-page SEO score (higher = worse = better prospect) ---
function scoreSeo(html, finalUrl) {
  const $ = cheerio.load(html);
  const issues = [];
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

// --- step 1: Overpass query for nearby businesses -----------------------
async function fetchBusinesses() {
  // amenity/shop/office/craft nodes & ways with a name in the radius.
  const q = `
    [out:json][timeout:60];
    (
      nwr(around:${RADIUS},${LAT},${LON})[shop][name];
      nwr(around:${RADIUS},${LAT},${LON})[amenity~"^(cafe|restaurant|bar|pub|pharmacy|dentist|clinic|veterinary|gym|fitness_centre|hairdresser|estate_agent|coworking_space)$"][name];
      nwr(around:${RADIUS},${LAT},${LON})[office][name];
      nwr(around:${RADIUS},${LAT},${LON})[craft][name];
    );
    out tags center;
  `;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.elements || [];
    } catch (err) {
      console.warn(`  Overpass ${url} failed: ${err.message}; trying next…`);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

// --- step 2: scrape a website for an email ------------------------------
function cleanUrl(u) {
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

async function getHtml(url, timeoutMs = 9000) {
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

function emailsFromHtml(html) {
  const found = new Set();
  const $ = cheerio.load(html);
  // mailto links are the most reliable
  $('a[href^="mailto:"]').each((_, el) => {
    const e = normEmail(($(el).attr('href') || '').split('?')[0].replace('mailto:', ''));
    if (validEmail(e)) found.add(e);
  });
  // fallback: regex the visible text + raw html
  const text = $('body').text() + ' ' + html;
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = normEmail(m[0]);
    if (validEmail(e)) found.add(e);
  }
  return [...found];
}

async function scrapeEmail(websiteUrl) {
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
      // prefer an email whose domain matches the site
      const host = base.hostname.replace(/^www\./, '');
      const onDomain = emails.find((e) => e.split('@')[1].includes(host) || host.includes(e.split('@')[1].split('.')[0]));
      return onDomain || emails[0];
    }
    await sleep(150);
  }
  return null;
}

// --- main ---------------------------------------------------------------
async function main() {
  console.log(`Searching businesses within ${RADIUS}m of (${LAT}, ${LON})…`);
  const elements = await fetchBusinesses();
  console.log(`  Overpass returned ${elements.length} businesses.`);

  // de-dupe by name+website
  const seen = new Set();
  const businesses = [];
  for (const el of elements) {
    const t = el.tags || {};
    const name = t.name;
    if (!name) continue;
    // Skip chains / big corps — OSM `brand`/`brand:wikidata` tag is the strongest
    // signal a place is part of a chain; fall back to a name blocklist.
    if (t.brand || t['brand:wikidata'] || CHAINS.test(name)) continue;
    // Skip orgs / charities / unions / institutions — not boutique prospects.
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
  console.log(`  ${businesses.length} unique named businesses.`);

  // Oversample candidates so that after MX-filtering + worst-SEO ranking we
  // still have TARGET. We rank/trim at the end, not here.
  const OVERSAMPLE = Math.ceil(TARGET * 1.8);
  const leads = [];
  const haveEmail = (e) => leads.some((l) => l.email === e);

  // 1) Take OSM-tagged emails first (free, no scraping).
  for (const b of businesses) {
    if (leads.length >= OVERSAMPLE) break;
    if (b.tagEmail && !haveEmail(b.tagEmail)) {
      leads.push({ ...b, email: b.tagEmail, source: 'osm-tag' });
    }
  }
  console.log(`  ${leads.length} leads from OSM email tags.`);

  // 2) Scrape websites for the rest (concurrency-limited).
  const toScrape = businesses.filter((b) => !b.tagEmail && b.website);
  console.log(`  Scraping up to ${toScrape.length} websites for emails…`);

  const CONCURRENCY = 6;
  let idx = 0;
  async function scrapeWorker() {
    while (idx < toScrape.length && leads.length < OVERSAMPLE) {
      const b = toScrape[idx++];
      const email = await scrapeEmail(b.website);
      if (email && validEmail(email) && !haveEmail(email)) {
        leads.push({ ...b, email, source: 'website' });
        process.stdout.write(`  ✓ found ${leads.length}  ${b.name}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, scrapeWorker));

  // 3) Enrich: verify the email domain (MX) + score the homepage SEO.
  console.log(`\nVerifying email domains (MX) and scoring SEO for ${leads.length} leads…`);
  let ei = 0;
  async function enrichWorker() {
    while (ei < leads.length) {
      const l = leads[ei++];
      l.mxValid = await hasMx(l.email);
      if (l.website) {
        const base = cleanUrl(l.website);
        const html = base ? await getHtml(base.href) : null;
        if (html) {
          const { score, issues } = scoreSeo(html, base.href);
          l.seoScore = score;
          l.seoIssues = issues;
        }
      }
      if (l.seoScore === undefined) {
        l.seoScore = l.website ? 5 : 6; // unreachable site = likely poor; no site = worst
        l.seoIssues = l.website ? ['site unreachable'] : ['no website'];
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, enrichWorker));

  // 4) Keep only deliverable domains, rank worst-SEO first, trim to TARGET.
  const deliverable = leads.filter((l) => l.mxValid);
  const dropped = leads.length - deliverable.length;
  deliverable.sort((a, b) => b.seoScore - a.seoScore);
  const final = deliverable.slice(0, TARGET);
  console.log(`  ${deliverable.length} passed MX (dropped ${dropped} with no mail server).`);

  // --- output ---
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = resolve(outDir, `leads-${stamp}.csv`);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'name,category,email,phone,website,source,mx_valid,seo_score,seo_issues';
  const rows = final.map((l) =>
    [l.name, l.category, l.email, l.phone, l.website || '', l.source, l.mxValid ? 'yes' : 'no',
     l.seoScore, (l.seoIssues || []).join('; ')].map(esc).join(',')
  );
  writeFileSync(file, [header, ...rows].join('\n') + '\n');

  console.log(`\nDone. ${final.length} verified leads, ranked worst-SEO first → ${file}`);
  if (final.length < TARGET) {
    console.log(`(Wanted ${TARGET}; try a larger --radius to get more.)`);
  }
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
