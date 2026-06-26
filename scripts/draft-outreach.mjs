#!/usr/bin/env node
/**
 * Draft personalised cold-outreach emails from a leads CSV.
 * Each email opens with the business's single worst, real SEO issue (from the
 * `seo_issues` column) so it reads as researched, not blasted.
 *
 * Usage:
 *   node scripts/draft-outreach.mjs                       # latest leads CSV
 *   node scripts/draft-outreach.mjs scripts/out/leads-XYZ.csv \
 *        --sender "Avin" --tool "RankRadar" --url "https://rankradar.app" --calendar "https://cal.com/avin"
 *
 * Output: scripts/out/outreach-<timestamp>.md  (one draft per lead)
 *
 * NOTE: this only WRITES drafts to a file. It does not send anything.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'out');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};
const SENDER = arg('sender', '{{YOUR NAME}}');
const TOOL = arg('tool', '{{YOUR TOOL}}');
const URL = arg('url', '{{your-tool-url}}');
const CALENDAR = arg('calendar', '{{your-booking-link}}');

// pick the CSV: first positional arg, else newest leads-*.csv
const csvPath =
  argv.find((a) => a.endsWith('.csv')) ||
  resolve(outDir, readdirSync(outDir).filter((f) => f.startsWith('leads-') && f.endsWith('.csv')).sort().pop());

// minimal CSV parser (handles quoted fields)
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// Plain-English hook for each SEO issue, ordered by impact (first match wins).
const HOOKS = [
  ['no title tag', 'your homepage is missing its page title — that\'s the headline Google shows in search results, so right now it has nothing to display'],
  ['no meta description', 'there\'s no meta description on your site, so Google is auto-guessing the grey summary text under your listing instead of you controlling it'],
  ['no H1', 'your homepage has no main heading (H1), which is one of the first things search engines read to understand what you do'],
  ['poor title length', 'your page title is getting cut off in search results, so people don\'t see your full name/offer before clicking'],
  ['not on HTTPS', 'your site isn\'t on HTTPS — browsers flag that as "Not secure", which scares off visitors and hurts ranking'],
  ['not mobile-friendly', 'your site is missing the mobile viewport setting, so it likely renders badly on phones (where most local searches happen)'],
  ['multiple H1s', 'your homepage has several competing main headings, which muddies what Google thinks the page is about'],
  ['no Open Graph', 'when someone shares your site on WhatsApp/Instagram, there\'s no preview image or title set up, so the link looks broken'],
  ['no structured data', 'you\'re missing structured data, so you\'re not eligible for the rich results (stars, hours, menu) that make listings stand out'],
  ['images missing alt text', 'a lot of your images have no alt text — that\'s missed ranking signal and an accessibility gap'],
  ['no canonical', 'your pages have no canonical tag, which can split your ranking across duplicate URLs'],
];

function hookFor(issuesStr) {
  const s = (issuesStr || '').toLowerCase();
  for (const [key, line] of HOOKS) if (s.includes(key)) return line;
  return 'a few quick on-page SEO fixes could help you show up more in local search';
}

function firstName(sender) {
  return sender.split(/\s+/)[0];
}

function draft(lead) {
  const hook = hookFor(lead.seo_issues);
  const place = 'King\'s Cross';
  const subject = `Quick SEO note about ${lead.name}`;
  const body = `Hi ${lead.name} team,

I was looking at ${place} businesses online and noticed something on your site: ${hook}.

It's a quick fix, and for a local spot like yours it can make a real difference in how many people find you on Google. I run ${TOOL} (${URL}) — it scans a site, lists exactly what's holding it back, and shows how to fix each one.

Want me to send over a free, no-strings audit of ${lead.name}? If it's useful we can chat${CALENDAR.startsWith('{{') ? '' : ` (${CALENDAR})`}; if not, no worries at all.

Cheers,
${SENDER}

—
Sent because ${lead.name} is a ${place} business with a public contact address. Not interested? Reply "unsubscribe" and I won't email again.`;
  return { subject, body };
}

// --- run ---
const leads = parseCsv(readFileSync(csvPath, 'utf8'));
const parts = [
  `# Cold-outreach drafts (${leads.length})`,
  `Source: ${csvPath.split('/').pop()}`,
  `Sender: ${SENDER} · Tool: ${TOOL}`,
  '',
  '> Drafts only — nothing has been sent. Review, then send via your outreach tool.',
  '',
];
leads.forEach((l, i) => {
  const { subject, body } = draft(l);
  parts.push(`## ${i + 1}. ${l.name}  —  ${l.email}`);
  parts.push(`**Subject:** ${subject}`);
  parts.push('');
  parts.push('```');
  parts.push(body);
  parts.push('```');
  parts.push('');
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = resolve(outDir, `outreach-${stamp}.md`);
writeFileSync(file, parts.join('\n'));
console.log(`Wrote ${leads.length} personalised drafts → ${file}`);
console.log('Nothing was sent.');
