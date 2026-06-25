#!/usr/bin/env node
/**
 * Verify RESEND_API_KEY by sending a test email.
 * Usage: node scripts/test-resend.mjs you@example.com
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.local'));

const to = process.argv[2];
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? 'SynapseCRO <onboarding@resend.dev>';

if (!apiKey) {
  console.error('RESEND_API_KEY is not set. Add it to .env or .env.local');
  process.exit(1);
}

if (!to) {
  console.error('Usage: node scripts/test-resend.mjs you@example.com');
  process.exit(1);
}

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to,
    subject: 'SynapseCRO — Resend test',
    html: '<p>If you received this, Resend is configured correctly.</p>',
  }),
});

const body = await response.text();

if (!response.ok) {
  console.error('Resend test failed:', response.status, body);
  process.exit(1);
}

console.log('Test email sent to', to);
console.log(body);
