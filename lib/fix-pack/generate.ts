import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { runLlmObject } from '@/lib/llm/generate';
import { detectSitePlatform } from '@/lib/fix-pack/platforms';
import { fixPackResponseSchema } from '@/lib/fix-pack/schemas';
import type { AuditFixPack } from '@/lib/fix-pack/types';
import { FIX_PACK_SYSTEM_PROMPT, buildFixPackUserPrompt } from '@/lib/prompts/fix-pack';
import type { AuditDetail, AuditFinding, AuditPage } from '@/lib/research/types';
import { fetchSeoPromptContext } from '@/lib/seo/prompt-context';

export interface GenerateFixPackParams {
  audit: Pick<
    AuditDetail,
    'id' | 'target_url' | 'keyword' | 'business_name' | 'recommendations' | 'lead_id'
  >;
  findings: AuditFinding[];
  pages: AuditPage[];
  seoContext?: string;
}

export async function generateFixPack(params: GenerateFixPackParams): Promise<AuditFixPack> {
  const { audit, findings, pages, seoContext } = params;
  const platform = detectSitePlatform(
    audit.target_url,
    pages.map((p) => ({ seo_json: p.seo_json }))
  );

  const response = await runLlmObject({
    system: FIX_PACK_SYSTEM_PROMPT,
    prompt: buildFixPackUserPrompt({
      businessName: audit.business_name,
      keyword: audit.keyword,
      targetUrl: audit.target_url,
      platform,
      findings: findings.map((f) => ({
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
      })),
      pages: pages.map((p) => ({
        url: p.url,
        is_target: p.is_target,
        page_type: p.page_type,
        seo: p.seo_json,
      })),
      recommendations: audit.recommendations,
      seoContext,
    }),
    schema: fixPackResponseSchema,
    telemetry: { functionId: 'fix-pack-generate' },
  });

  return {
    platformId: platform.id,
    platformLabel: platform.label,
    platformSupportsCodeInjection: platform.supportsCodeInjection,
    summary: response.summary,
    copyPaste: response.copyPaste,
    schemaSnippets: response.schemaSnippets,
    diffs: response.diffs,
    playbooks: response.playbooks,
    checklist: response.checklist,
    offPageActions: response.offPageActions,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateFixPackForAuditId(
  supabase: SupabaseClient,
  auditId: string
): Promise<AuditFixPack> {
  const { data: audit, error: auditError } = await supabase
    .from('site_audits')
    .select('id, target_url, keyword, business_name, recommendations, lead_id, status')
    .eq('id', auditId)
    .maybeSingle();

  if (auditError || !audit) {
    throw new Error(auditError?.message ?? 'Audit not found');
  }

  if (audit.status !== 'completed') {
    throw new Error('Audit must be completed before generating a fix pack');
  }

  const [findingsRes, pagesRes] = await Promise.all([
    supabase.from('audit_findings').select('*').eq('audit_id', auditId),
    supabase.from('audit_pages').select('*').eq('audit_id', auditId),
  ]);

  if (findingsRes.error) throw new Error(findingsRes.error.message);
  if (pagesRes.error) throw new Error(pagesRes.error.message);

  const seoContext = audit.lead_id
    ? await fetchSeoPromptContext({ leadId: audit.lead_id as string, auditId })
    : await fetchSeoPromptContext({ auditId });

  return generateFixPack({
    audit: audit as GenerateFixPackParams['audit'],
    findings: (findingsRes.data ?? []) as AuditFinding[],
    pages: (pagesRes.data ?? []).map((p) => ({
      url: p.url as string,
      is_target: Boolean(p.is_target),
      page_type: (p.page_type as string) ?? 'unknown',
      seo_json: p.seo_json as AuditPage['seo_json'],
      scraped_at: (p.scraped_at as string) ?? new Date().toISOString(),
    })),
    seoContext: seoContext ?? undefined,
  });
}
