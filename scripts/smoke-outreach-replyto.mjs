#!/usr/bin/env node
/**
 * Smoke test for the outreach reply_to wiring.
 * Sends a test email with reply_to set, mirroring lib/email/send-outreach-email.ts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.local'));

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? 'SynapseCRO <onboarding@resend.dev>';
const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim() || 'ram+seo@acyclic.dev';
const to = process.argv[2] || replyTo;

if (!apiKey) { console.error('RESEND_API_KEY not set'); process.exit(1); }

console.log('from:    ', from);
console.log('to:      ', to);
console.log('reply_to:', replyTo);

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to,
    reply_to: replyTo,
    subject: 'SynapseCRO — reply_to smoke test',
    text: `If you got this, sending works. Hit reply — it should go to ${replyTo}.`,
    html: `<p>If you got this, sending works.</p><p><strong>Hit reply</strong> — it should go to <code>${replyTo}</code>.</p>`,
  }),
});

const body = await response.text();
if (!response.ok) {
  console.error('FAILED:', response.status, body);
  process.exit(1);
}
console.log('SENT OK:', body);
