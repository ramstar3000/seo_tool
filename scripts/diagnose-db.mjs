import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key] === undefined) process.env[key] = trimmed.slice(eq + 1);
  }
}

const root = resolve(import.meta.dirname, '..');
loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.log('NO_SUPABASE_CONFIG');
  process.exit(1);
}

const sb = createClient(url, key);

async function checkTable(name) {
  const { error } = await sb.from(name).select('id').limit(1);
  if (error) {
    console.log(`TABLE ${name}: ERROR ${error.code} - ${error.message}`);
    return false;
  }
  console.log(`TABLE ${name}: OK`);
  return true;
}

async function testInsert() {
  const { data, error } = await sb
    .from('audit_requests')
    .insert({
      email: 'diag@example.com',
      website_url: 'https://humanorai.fly.dev/',
      business_name: 'Diag',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.log('INSERT audit_requests:', JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }));
    return;
  }
  console.log('INSERT audit_requests OK:', data.id);
  await sb.from('audit_requests').delete().eq('id', data.id);
}

async function main() {
  console.log('URL set:', Boolean(url));
  console.log('KEY set:', Boolean(key));
  await checkTable('site_copy');
  await checkTable('audit_requests');
  await checkTable('site_audits');
  await testInsert();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
