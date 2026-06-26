#!/usr/bin/env node
/**
 * Smoke test for local (or any) ClickHouse — no Next.js required.
 *
 * Usage:
 *   npm run clickhouse:smoke
 *   CLICKHOUSE_URL=http://localhost:8123 npm run clickhouse:smoke
 *
 * Prerequisite: ClickHouse running (e.g. npm run clickhouse:up)
 */
import { spawn } from 'node:child_process';
import { createClient } from '@clickhouse/client';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.CLICKHOUSE_URL?.trim() || 'http://localhost:8123';
const user = process.env.CLICKHOUSE_USER?.trim() || 'default';
const password = process.env.CLICKHOUSE_PASSWORD ?? '';
const database = process.env.CLICKHOUSE_DATABASE?.trim() || 'default';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
}

function computeConversionRate(pageViews, ctaClicks) {
  if (pageViews <= 0) return null;
  return Math.round((ctaClicks / pageViews) * 1000) / 10;
}

async function httpPing(clickhouseUrl) {
  const pingUrl = `${clickhouseUrl.replace(/\/$/, '')}/ping`;
  const res = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
  return res.ok && (await res.text()).trim() === 'Ok.';
}

function runInit() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/clickhouse-init.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, CLICKHOUSE_URL: url, CLICKHOUSE_USER: user, CLICKHOUSE_PASSWORD: password, CLICKHOUSE_DATABASE: database },
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`init exited ${code}`))));
  });
}

async function main() {
  console.log('SynapseCRO ClickHouse smoke test');
  console.log(`  URL: ${url}`);
  console.log('');

  // 1. Ping
  try {
    const ok = await httpPing(url);
    if (ok) pass('HTTP ping (/ping)');
    else fail('HTTP ping (/ping)', 'unexpected response');
  } catch (err) {
    fail('HTTP ping (/ping)', err instanceof Error ? err.message : String(err));
    console.error('\nClickHouse is not reachable. Start it with:');
    console.error('  npm run clickhouse:up');
    console.error('  # or: docker compose -f docker-compose.clickhouse.yml up -d');
    printSummary();
    process.exit(1);
  }

  const ch = createClient({
    url,
    username: user,
    password,
    database,
    application: 'synapsecro-smoke',
  });

  try {
    const ping = await ch.ping();
    if (ping.success) pass('Client ping');
    else fail('Client ping');
  } catch (err) {
    fail('Client ping', err instanceof Error ? err.message : String(err));
    await ch.close();
    printSummary();
    process.exit(1);
  }

  // 2. Init schema
  try {
    await runInit();
    pass('clickhouse-init.mjs');
  } catch (err) {
    fail('clickhouse-init.mjs', err instanceof Error ? err.message : String(err));
  }

  const auditId = randomUUID();
  const leadId = randomUUID();

  // 3. Sample analytics
  try {
    await ch.insert({
      table: 'analytics_events',
      values: [
        { event_type: 'page_view', path: '/', referrer: 'smoke-test', user_agent: 'smoke/1.0' },
        { event_type: 'page_view', path: '/', referrer: 'smoke-test', user_agent: 'smoke/1.0' },
        { event_type: 'cta_click', path: '/', referrer: 'smoke-test', user_agent: 'smoke/1.0' },
      ],
      format: 'JSONEachRow',
    });
    pass('Insert analytics_events (2 page_view, 1 cta_click)');
  } catch (err) {
    fail('Insert analytics_events', err instanceof Error ? err.message : String(err));
  }

  // 4. Sample SEO insights
  try {
    await ch.insert({
      table: 'seo_insight_events',
      values: [
        {
          event_type: 'audit_summary',
          audit_id: auditId,
          lead_id: leadId,
          business_name: 'Smoke Test Co',
          keyword: 'local seo smoke',
          target_url: 'https://example.com',
          rank_position: 12,
          critical_count: 1,
          warning_count: 1,
          info_count: 0,
          finding_count: 2,
          summary_snippet: 'Smoke audit summary',
          recommendations_snippet: 'Fix title tags',
        },
        {
          event_type: 'finding',
          audit_id: auditId,
          lead_id: leadId,
          business_name: 'Smoke Test Co',
          keyword: 'local seo smoke',
          target_url: 'https://example.com',
          severity: 'critical',
          category: 'on-page',
          title: 'Missing meta description',
          description: 'Homepage has no meta description.',
        },
        {
          event_type: 'finding',
          audit_id: auditId,
          lead_id: leadId,
          business_name: 'Smoke Test Co',
          keyword: 'local seo smoke',
          target_url: 'https://example.com',
          severity: 'warning',
          category: 'technical',
          title: 'Slow LCP',
          description: 'Largest contentful paint above threshold.',
        },
      ],
      format: 'JSONEachRow',
    });
    pass('Insert seo_insight_events (1 summary + 2 findings)');
  } catch (err) {
    fail('Insert seo_insight_events', err instanceof Error ? err.message : String(err));
  }

  // 5. Query conversion metrics
  try {
    const result = await ch.query({
      query: `
        SELECT
          countIf(event_type = 'page_view') AS page_views,
          countIf(event_type = 'cta_click') AS cta_clicks
        FROM analytics_events
        WHERE created_at >= now() - INTERVAL 1 DAY
      `,
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    const row = rows[0];
    const pageViews = Number(row?.page_views ?? 0);
    const ctaClicks = Number(row?.cta_clicks ?? 0);
    const rate = computeConversionRate(pageViews, ctaClicks);
    if (pageViews >= 2 && ctaClicks >= 1) {
      pass('Conversion metrics query', `pageViews=${pageViews} ctaClicks=${ctaClicks} rate=${rate}%`);
    } else {
      fail('Conversion metrics query', `pageViews=${pageViews} ctaClicks=${ctaClicks} (expected >=2 / >=1)`);
    }
  } catch (err) {
    fail('Conversion metrics query', err instanceof Error ? err.message : String(err));
  }

  // 6. Query SEO insight metrics
  try {
    const summaryRes = await ch.query({
      query: `
        SELECT
          count() AS audit_count,
          sum(finding_count) AS finding_count,
          sum(critical_count) AS critical_count,
          sum(warning_count) AS warning_count
        FROM seo_insight_events
        WHERE event_type = 'audit_summary'
          AND completed_at >= now() - INTERVAL 1 DAY
      `,
      format: 'JSONEachRow',
    });
    const categoryRes = await ch.query({
      query: `
        SELECT category, severity, count() AS cnt
        FROM seo_insight_events
        WHERE event_type = 'finding'
          AND completed_at >= now() - INTERVAL 1 DAY
        GROUP BY category, severity
        ORDER BY category
      `,
      format: 'JSONEachRow',
    });
    const summary = (await summaryRes.json())[0];
    const categories = await categoryRes.json();
    const auditCount = Number(summary?.audit_count ?? 0);
    const findingCount = Number(summary?.finding_count ?? 0);
    if (auditCount >= 1 && findingCount >= 2) {
      pass(
        'SEO insight metrics query',
        `audits=${auditCount} findings=${findingCount} categories=${categories.length}`,
      );
    } else {
      fail('SEO insight metrics query', `audits=${auditCount} findings=${findingCount}`);
    }
  } catch (err) {
    fail('SEO insight metrics query', err instanceof Error ? err.message : String(err));
  }

  await ch.close();
  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log('All checks passed.');
  } else {
    console.log(`${failed.length} check(s) failed:`);
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
