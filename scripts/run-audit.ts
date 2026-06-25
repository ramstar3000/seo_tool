/**
 * Run a visitor audit locally without going through the HTTP API.
 * Loads .env / .env.local, runs runResearchAgent, optionally persists to Supabase.
 *
 * Usage:
 *   npx tsx scripts/run-audit.ts
 *   npx tsx scripts/run-audit.ts --url https://humanorai.fly.dev/ --business "Human or AI"
 *   npx tsx scripts/run-audit.ts --persist
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { runResearchAgent } from '../lib/research/agent';
import { inferKeywordFromWebsite } from '../lib/leads/infer-keyword';
import { saveAuditToSupabase } from '../lib/research/persist';
import { getSupabaseAdmin } from '../lib/supabase/admin';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]): {
  url: string;
  businessName: string;
  email: string;
  persist: boolean;
} {
  let url = 'https://humanorai.fly.dev/';
  let businessName = 'Human or AI';
  let email = 'test@humanorai.dev';
  let persist = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) url = argv[++i];
    else if (arg === '--business' && argv[i + 1]) businessName = argv[++i];
    else if (arg === '--email' && argv[i + 1]) email = argv[++i];
    else if (arg === '--persist') persist = true;
  }

  return { url, businessName, email, persist };
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '..');
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, '.env.local'));

  const { url, businessName, email, persist } = parseArgs(process.argv.slice(2));
  const keyword = inferKeywordFromWebsite(url, businessName);

  console.log(`Auditing ${url} (${businessName})…`);
  const start = Date.now();

  const result = await runResearchAgent({ targetUrl: url, keyword, businessName });

  console.log('\n--- Audit result ---');
  console.log('Status:', result.audit.status);
  console.log('Summary:', result.audit.summary);
  console.log('\nRecommendations:', result.audit.recommendations);
  console.log(`\nFindings (${result.findings.length}):`);
  for (const f of result.findings) {
    console.log(`  [${f.severity}] ${f.category}: ${f.title}`);
  }

  if (result.pages[0]?.seo_json) {
    const seo = result.pages[0].seo_json;
    console.log('\nSEO signals:', {
      title: seo.title,
      metaDescription: seo.metaDescription,
      h1: seo.h1,
      ctas: seo.ctas,
      wordCount: seo.wordCount,
    });
  }

  let auditId: string | undefined;
  let requestId: string | undefined;

  if (persist) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.warn('\nSupabase not configured — skipping persistence.');
    } else {
      try {
        const { auditId: savedId } = await saveAuditToSupabase(supabase, result);
        auditId = savedId;

        const { data: requestRow, error: requestError } = await supabase
          .from('audit_requests')
          .insert({
            email,
            website_url: url,
            business_name: businessName,
            status: 'completed',
            site_audit_id: auditId,
            report_summary: result.audit.summary,
          })
          .select('id')
          .single();

        if (requestError) {
          console.warn('Saved site_audit but audit_requests insert failed:', requestError.message);
        } else {
          requestId = requestRow?.id as string;
        }

        console.log('\nPersisted site_audit_id:', auditId);
        if (requestId) console.log('Visitor audit URL: /audit/' + requestId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\nPersistence failed:', message);
        if (message.includes('audit_requests') || message.includes('site_audits')) {
          console.error('Apply supabase/schema.sql in the Supabase SQL Editor, then retry with --persist.');
        }
      }
    }
  }

  console.log(`\nCompleted in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
