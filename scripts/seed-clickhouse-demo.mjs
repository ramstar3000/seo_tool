#!/usr/bin/env node
/**
 * Seed ClickHouse with hackathon demo data — scale + "issues persisting 14 days".
 *
 * Usage: npm run clickhouse:seed-demo
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import { loadDotEnv } from './lib/load-dotenv.mjs';

loadDotEnv();

const url = process.env.CLICKHOUSE_URL?.trim();
const password = process.env.CLICKHOUSE_PASSWORD ?? '';
const user = process.env.CLICKHOUSE_USER?.trim() || 'default';
const database = process.env.CLICKHOUSE_DATABASE?.trim() || 'default';

if (!url) {
  console.error('Set CLICKHOUSE_URL in .env');
  process.exit(1);
}

const DEMO_LEAD_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUSINESS = 'Camden Smile Dental';
const KEYWORD = 'dentist Camden';
const TARGET_URL = 'https://camdensmiledental.co.uk';

function formatDt(date) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

const PERSISTENT_FINDINGS = [
  {
    severity: 'critical',
    category: 'seo',
    title: 'Missing meta description',
    description: 'Homepage has no meta description — hurts CTR in SERPs for dentist Camden.',
  },
  {
    severity: 'critical',
    category: 'technical',
    title: 'No LocalBusiness schema',
    description: 'No JSON-LD LocalBusiness or Dentist schema on homepage.',
  },
  {
    severity: 'critical',
    category: 'seo',
    title: 'Thin Invisalign landing page',
    description: 'Invisalign service page under 300 words; competitors rank with rich content.',
  },
  {
    severity: 'warning',
    category: 'technical',
    title: 'Slow LCP',
    description: 'Largest Contentful Paint 3.8s on mobile PageSpeed.',
  },
];

const LCP_BY_AUDIT = [4200, 3900, 3800];

async function main() {
  const ch = createClient({ url, username: user, password, database, application: 'synapsecro-seed' });

  const ping = await ch.ping();
  if (!ping.success) throw new Error('ClickHouse ping failed');

  console.log('Seeding in-depth hackathon demo data…');

  const analyticsRows = [];
  const hourlyAgg = new Map();

  for (let day = 0; day < 30; day++) {
    for (let hour = 7; hour <= 21; hour++) {
      const dt = daysAgo(day);
      dt.setUTCHours(hour, 0, 0, 0);
      const hourKey = formatDt(new Date(dt.getTime())).slice(0, 13) + ':00:00.000';
      const views = 4 + (hour % 6) + (day % 4);
      const clicks = hour % 5 === 0 ? 2 : hour % 3 === 0 ? 1 : 0;

      for (let i = 0; i < views; i++) {
        analyticsRows.push({
          event_type: 'page_view',
          path: '/',
          referrer: i % 4 === 0 ? 'https://google.com/' : '',
          user_agent: 'SynapseCRO-DemoSeed/1.0',
          created_at: formatDt(dt),
        });
      }
      for (let i = 0; i < clicks; i++) {
        analyticsRows.push({
          event_type: 'cta_click',
          path: '/',
          referrer: '',
          user_agent: 'SynapseCRO-DemoSeed/1.0',
          created_at: formatDt(dt),
        });
      }

      const h = hourKey.replace('.000', '');
      hourlyAgg.set(`${h}|page_view`, (hourlyAgg.get(`${h}|page_view`) ?? 0) + views);
      hourlyAgg.set(`${h}|cta_click`, (hourlyAgg.get(`${h}|cta_click`) ?? 0) + clicks);
    }
  }

  const seoRows = [];
  const agentRows = [];
  const auditDays = [14, 7, 0];

  for (let i = 0; i < auditDays.length; i++) {
    const dayOffset = auditDays[i];
    const completedAt = formatDt(daysAgo(dayOffset));
    const auditId = randomUUID();
    const lcpMs = LCP_BY_AUDIT[i];

    seoRows.push({
      event_type: 'audit_summary',
      audit_id: auditId,
      lead_id: DEMO_LEAD_ID,
      business_name: BUSINESS,
      keyword: KEYWORD,
      target_url: TARGET_URL,
      rank_position: 4,
      lcp_ms: lcpMs,
      competitor_count: 5,
      severity: '',
      category: '',
      title: '',
      description: '',
      critical_count: 3,
      warning_count: 1,
      info_count: 0,
      finding_count: 4,
      summary_snippet: `Rank #4 for "${KEYWORD}". Three critical SEO gaps unchanged since last re-audit.`,
      recommendations_snippet: 'Add meta description, LocalBusiness schema, and expand Invisalign page.',
      completed_at: completedAt,
    });

    for (const f of PERSISTENT_FINDINGS) {
      seoRows.push({
        event_type: 'finding',
        audit_id: auditId,
        lead_id: DEMO_LEAD_ID,
        business_name: BUSINESS,
        keyword: KEYWORD,
        target_url: TARGET_URL,
        rank_position: 4,
        lcp_ms: lcpMs,
        competitor_count: 5,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        finding_count: 0,
        summary_snippet: '',
        recommendations_snippet: '',
        completed_at: completedAt,
      });
    }

    agentRows.push({
      loop_type: 'audit_ingest',
      lead_id: DEMO_LEAD_ID,
      audit_id: auditId,
      payload: JSON.stringify({ businessName: BUSINESS, keyword: KEYWORD }),
      metrics_snapshot: JSON.stringify({ rankPosition: 4, lcpMs, critical: 3 }),
      created_at: completedAt,
    });
  }

  agentRows.push({
    loop_type: 'optimize',
    lead_id: DEMO_LEAD_ID,
    audit_id: null,
    payload: JSON.stringify({
      actionTaken: 'Rewrote hero_subtitle to mention Invisalign and Camden ranking.',
    }),
    metrics_snapshot: JSON.stringify({
      viewCount: analyticsRows.filter((r) => r.event_type === 'page_view').length,
      clickCount: analyticsRows.filter((r) => r.event_type === 'cta_click').length,
      conversionRate: '8.2',
      seoContextUsed: true,
    }),
    created_at: formatDt(new Date()),
  });

  const hourlyAggRows = [];
  for (const [key, count] of hourlyAgg) {
    const [hour, eventType] = key.split('|');
    hourlyAggRows.push({ hour, event_type: eventType, event_count: count });
  }

  await ch.insert({ table: 'analytics_events', values: analyticsRows, format: 'JSONEachRow' });
  await ch.insert({ table: 'seo_insight_events', values: seoRows, format: 'JSONEachRow' });
  await ch.insert({ table: 'agent_loop_events', values: agentRows, format: 'JSONEachRow' });
  if (hourlyAggRows.length) {
    await ch.insert({ table: 'analytics_hourly_agg', values: hourlyAggRows, format: 'JSONEachRow' });
  }

  console.log(`  ✓ ${analyticsRows.length} analytics events (30 days × hourly)`);
  console.log(`  ✓ ${hourlyAggRows.length} hourly MV backfill rows`);
  console.log(`  ✓ ${seoRows.length} SEO insight rows (3 re-audits, 14-day persistent issues)`);
  console.log(`  ✓ ${agentRows.length} agent loop events`);
  console.log('\nOpen: /clickhouse or curl /api/clickhouse/showcase | jq');

  await ch.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
