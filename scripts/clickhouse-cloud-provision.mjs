#!/usr/bin/env node
/**
 * Provision SynapseCRO ClickHouse database credentials via ClickHouse Cloud API.
 *
 * Uses console API keys (CLICKHOUSE_KEY_ID + CLICKHOUSE_API_KEY) to:
 * - resolve organization + services
 * - create a development service if none exists (optional)
 * - rotate/fetch default user password via Cloud API
 * - write CLICKHOUSE_URL + CLICKHOUSE_PASSWORD to .env
 *
 * Usage:
 *   node scripts/clickhouse-cloud-provision.mjs
 *   node scripts/clickhouse-cloud-provision.mjs --create-if-missing
 *   node scripts/clickhouse-cloud-provision.mjs --service-name synapsecro
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadDotEnv } from './lib/load-dotenv.mjs';

const API_BASE = 'https://api.clickhouse.cloud/v1';
const DEFAULT_SERVICE_NAME = 'synapsecro';
const DEFAULT_REGION = process.env.CLICKHOUSE_CLOUD_REGION?.trim() || 'eu-west-2';

loadDotEnv();

const keyId = process.env.CLICKHOUSE_KEY_ID?.trim();
const keySecret =
  process.env.CLICKHOUSE_API_KEY?.trim() ||
  process.env.CLICKHOUSE_KEY_SECRET?.trim() ||
  process.env.CLICKHOUSE_API_SECRET?.trim();

const args = process.argv.slice(2);
const createIfMissing = args.includes('--create-if-missing');
const serviceNameArg = args.find((a) => a.startsWith('--service-name='))?.split('=')[1]?.trim();
const serviceName = serviceNameArg || process.env.CLICKHOUSE_SERVICE_NAME?.trim() || DEFAULT_SERVICE_NAME;

function authHeader() {
  if (!keyId || !keySecret) {
    throw new Error('Set CLICKHOUSE_KEY_ID and CLICKHOUSE_API_KEY in .env');
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function cloudFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body?.error ?? body?.message ?? JSON.stringify(body);
    throw new Error(`Cloud API ${options.method ?? 'GET'} ${path} failed (${response.status}): ${msg}`);
  }
  return body;
}

async function getOrganizationId() {
  if (process.env.CLICKHOUSE_ORG_ID?.trim()) {
    return process.env.CLICKHOUSE_ORG_ID.trim();
  }
  const data = await cloudFetch('/organizations');
  const orgs = data.result ?? [];
  if (!orgs.length) throw new Error('No organizations found for this API key');
  if (orgs.length === 1) return orgs[0].id;
  const named = orgs.find((o) => o.name);
  return (named ?? orgs[0]).id;
}

function pickHttpsEndpoint(service) {
  const endpoints = service.endpoints ?? [];
  const https =
    endpoints.find((e) => e.protocol === 'https') ??
    endpoints.find((e) => String(e.port) === '8443') ??
    endpoints.find((e) => e.host?.includes('clickhouse.cloud'));
  if (!https?.host) return null;
  const port = https.port && https.port !== 443 && https.port !== 8443 ? `:${https.port}` : https.port === 8443 ? ':8443' : ':8443';
  return {
    url: `https://${https.host}${port}`,
    username: https.username ?? 'default',
  };
}

async function listServices(orgId) {
  const data = await cloudFetch(`/organizations/${orgId}/services`);
  return data.result ?? [];
}

async function getService(orgId, serviceId) {
  const data = await cloudFetch(`/organizations/${orgId}/services/${serviceId}`);
  return data.result;
}

async function createService(orgId) {
  console.log(`Creating development service "${serviceName}" in ${DEFAULT_REGION}…`);
  const data = await cloudFetch(`/organizations/${orgId}/services`, {
    method: 'POST',
    body: JSON.stringify({
      name: serviceName,
      provider: 'aws',
      region: DEFAULT_REGION,
      tier: 'development',
      idleScaling: true,
      idleTimeoutMinutes: 15,
      ipAccessList: [{ source: '0.0.0.0/0', description: 'SynapseCRO dev (tighten for prod)' }],
    }),
  });
  return {
    service: data.result?.service ?? data.result,
    password: data.result?.password,
  };
}

async function rotatePassword(orgId, serviceId) {
  const data = await cloudFetch(`/organizations/${orgId}/services/${serviceId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  return data.result?.password;
}

async function ensureRunning(orgId, service) {
  if (service.state === 'running' || service.state === 'idle') return service;
  if (service.state === 'stopped') {
    console.log(`Starting service ${service.name}…`);
    await cloudFetch(`/organizations/${orgId}/services/${service.id}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ command: 'start' }),
    });
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const fresh = await getService(orgId, service.id);
    console.log(`  state: ${fresh.state}`);
    if (fresh.state === 'running' || fresh.state === 'idle') return fresh;
  }
  throw new Error(`Service ${service.id} did not reach running state in time`);
}

function upsertEnvFile(filename, entries) {
  const path = resolve(process.cwd(), filename);
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const keys = new Set(Object.keys(entries));
  const out = [];
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      out.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (keys.has(key)) {
      out.push(`${key}=${entries[key]}`);
      seen.add(key);
    } else {
      out.push(line);
    }
  }

  for (const [key, value] of Object.entries(entries)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }

  writeFileSync(path, out.join('\n').replace(/\n?$/, '\n'));
}

async function main() {
  console.log('ClickHouse Cloud provision\n');

  const orgId = await getOrganizationId();
  console.log(`Organization: ${orgId}`);

  let services = await listServices(orgId);
  let service =
    services.find((s) => s.name === serviceName) ??
    (process.env.CLICKHOUSE_SERVICE_ID
      ? services.find((s) => s.id === process.env.CLICKHOUSE_SERVICE_ID)
      : null) ??
    services[0];

  let password = process.env.CLICKHOUSE_PASSWORD?.trim() || null;

  if (!service && createIfMissing) {
    const created = await createService(orgId);
    service = created.service;
    password = created.password ?? password;
  }

  if (!service) {
    console.error(
      `No ClickHouse service found. Run with --create-if-missing or create a service in the console.\nServices: ${services.map((s) => s.name).join(', ') || '(none)'}`
    );
    process.exit(1);
  }

  console.log(`Service: ${service.name} (${service.id}) — ${service.state}`);

  service = await ensureRunning(orgId, service);

  const endpoint = pickHttpsEndpoint(service);
  if (!endpoint) {
    throw new Error('No HTTPS endpoint on service — try again once provisioning completes');
  }

  if (!password) {
    console.log('Fetching database password via Cloud API…');
    password = await rotatePassword(orgId, service.id);
  }

  if (!password) {
    throw new Error('Could not obtain database password');
  }

  const envEntries = {
    CLICKHOUSE_URL: endpoint.url,
    CLICKHOUSE_USER: endpoint.username,
    CLICKHOUSE_PASSWORD: password,
    CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE?.trim() || 'default',
    CLICKHOUSE_ORG_ID: orgId,
    CLICKHOUSE_SERVICE_ID: service.id,
  };

  upsertEnvFile('.env', envEntries);
  console.log('\nUpdated .env with database connection vars:');
  console.log(`  CLICKHOUSE_URL=${endpoint.url}`);
  console.log(`  CLICKHOUSE_USER=${endpoint.username}`);
  console.log('  CLICKHOUSE_PASSWORD=*** (written)');
  console.log(`  CLICKHOUSE_SERVICE_ID=${service.id}`);

  console.log('\nNext: npm run clickhouse:init && npm run clickhouse:smoke');
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
