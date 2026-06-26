#!/usr/bin/env node
/**
 * Validates ClickHouse env for SynapseCRO (@clickhouse/client).
 * Cloud console API keys (Settings → API Keys) are NOT database credentials.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadDotEnv } from './lib/load-dotenv.mjs';

loadDotEnv();

const url = process.env.CLICKHOUSE_URL?.trim();
const password = process.env.CLICKHOUSE_PASSWORD;
const apiKey = process.env.CLICKHOUSE_API_KEY?.trim();
const keyId = process.env.CLICKHOUSE_KEY_ID?.trim();

console.log('ClickHouse env check\n');

if (apiKey || keyId) {
  console.log('Found Cloud console API key vars:');
  if (keyId) console.log('  ✓ CLICKHOUSE_KEY_ID');
  if (apiKey) console.log('  ✓ CLICKHOUSE_API_KEY');
  console.log('');
  console.log(
    '  ⚠ These are for ClickHouse Cloud management (clickhousectl / console API).'
  );
  console.log('    They do NOT connect to your database for analytics inserts.\n');
}

if (url) {
  console.log(`  ✓ CLICKHOUSE_URL = ${url.replace(/\/\/[^@]+@/, '//***@')}`);
} else {
  console.log('  ✗ CLICKHOUSE_URL — missing');
}

if (password !== undefined && password !== '') {
  console.log('  ✓ CLICKHOUSE_PASSWORD — set');
} else if (url?.includes('localhost') || url?.includes('127.0.0.1')) {
  console.log('  ✓ CLICKHOUSE_PASSWORD — empty (OK for local Docker)');
} else {
  console.log('  ✗ CLICKHOUSE_PASSWORD — missing (needed for ClickHouse Cloud)');
}

console.log('');

if (url) {
  console.log('App database connection: READY (run npm run clickhouse:smoke)');
  process.exit(0);
}

console.log('App database connection: NOT CONFIGURED\n');
console.log('Get database credentials (different from API Keys page):');
console.log('  1. ClickHouse Cloud → Services → select your service');
console.log('  2. Click "Connect" → Node.js tab');
console.log('  3. Add to .env or .env.local:\n');
console.log('     CLICKHOUSE_URL=https://YOUR_HOST.clickhouse.cloud:8443');
console.log('     CLICKHOUSE_USER=default');
console.log('     CLICKHOUSE_PASSWORD=<password from Connect tab>');
console.log('     CLICKHOUSE_DATABASE=default\n');
console.log('Or use local Docker: npm run clickhouse:up + CLICKHOUSE_URL=http://localhost:8123');
process.exit(1);
