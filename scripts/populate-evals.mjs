#!/usr/bin/env node
/**
 * Drive evals through production website → Langfuse → ClickHouse llm_eval_events.
 *
 * Usage:
 *   CRON_SECRET=... node scripts/populate-evals.mjs
 *   node scripts/populate-evals.mjs --optimize-only
 *   node scripts/populate-evals.mjs --audits-only
 */
import { loadDotEnv } from './lib/load-dotenv.mjs';

loadDotEnv();

const BASE_URL = process.env.BASE_URL?.trim() || 'https://synapsecro.fly.dev';
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const optimizeOnly = process.argv.includes('--optimize-only');
const auditsOnly = process.argv.includes('--audits-only');

const AUDIT_TARGETS = [
  {
    email: 'eval-demo-1@acyclic.dev',
    websiteUrl: 'https://synapsecro.fly.dev',
    businessName: 'SynapseCRO',
  },
  {
    email: 'eval-demo-2@acyclic.dev',
    websiteUrl: 'https://example.com',
    businessName: 'Example Corp',
  },
];

async function fetchJson(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${body.error ?? JSON.stringify(body)}`);
  }
  return body;
}

async function runOptimize(label) {
  if (!CRON_SECRET) throw new Error('Set CRON_SECRET for POST /api/optimize');
  console.log(`\n→ POST /api/optimize (${label})…`);
  const body = await fetchJson('/api/optimize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  console.log(`  ✓ ${body.decision?.action_taken?.slice(0, 80) ?? 'ok'} (seoContextUsed=${body.seoContextUsed})`);
}

async function submitAudit(target) {
  console.log(`\n→ POST /api/audit-request (${target.businessName})…`);
  const body = await fetchJson('/api/audit-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });
  console.log(`  ✓ request ${body.id} → ${BASE_URL}${body.auditUrl}`);
  return body.id;
}

async function waitForAudit(id, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const body = await fetchJson(`/api/audit-request/${id}`);
    if (body.status === 'completed') {
      console.log(`  ✓ audit ${id} completed (${body.findings?.length ?? 0} findings)`);
      return body;
    }
    if (body.status === 'failed') {
      throw new Error(`audit ${id} failed: ${body.errorMessage ?? 'unknown'}`);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`audit ${id} timed out after ${timeoutMs / 1000}s`);
}

async function showEvalStats() {
  const showcase = await fetchJson('/api/clickhouse/showcase');
  console.log('\n=== ClickHouse eval stats ===');
  console.log('llmEvalEventCount:', showcase.scale?.llmEvalEventCount);
  for (const row of showcase.langfuse?.evalAggregates ?? []) {
    console.log(`  ${row.traceName} / ${row.scoreName}: avg=${row.avgValue} count=${row.count}`);
  }
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);

  if (!auditsOnly) {
    await runOptimize('global #1');
    await runOptimize('global #2');
  }

  if (!optimizeOnly) {
    for (const target of AUDIT_TARGETS) {
      const id = await submitAudit(target);
      await waitForAudit(id);
    }
  }

  await showEvalStats();
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
