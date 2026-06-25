import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { runResearchAgent } from '@/lib/research/agent';
import {
  createPendingAudit,
  markAuditFailed,
  saveAuditToSupabase,
} from '@/lib/research/persist';
import { RESEARCH_AGENT_MODEL } from '@/lib/anthropic/client';
import {
  buildVisitorAuditUserPrompt,
  VISITOR_AUDIT_SYSTEM_PROMPT,
} from '@/lib/prompts/visitor-audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function deriveKeyword(businessName: string): string {
  return `${businessName} near me`.slice(0, 200);
}

async function buildVisitorReportSummary(params: {
  businessName: string;
  websiteUrl: string;
  summary: string;
  recommendations: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
}): Promise<string> {
  const fallback = [params.summary, '', params.recommendations].filter(Boolean).join('\n\n');

  try {
    const { text } = await generateText({
      model: anthropic(RESEARCH_AGENT_MODEL),
      system: VISITOR_AUDIT_SYSTEM_PROMPT,
      prompt: buildVisitorAuditUserPrompt({
        businessName: params.businessName,
        websiteUrl: params.websiteUrl,
        executiveSummary: params.summary,
        recommendations: params.recommendations,
        findings: params.findings,
      }),
      maxOutputTokens: 1024,
    });

    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function processAuditRequest(requestId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data: request, error: fetchError } = await supabase
    .from('audit_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) return;
  if (request.status !== 'pending') return;

  await supabase.from('audit_requests').update({ status: 'processing' }).eq('id', requestId);

  const businessName =
    (request.business_name as string | null) ??
    (() => {
      try {
        return new URL(request.website_url).hostname;
      } catch {
        return 'Your business';
      }
    })();
  const keyword = deriveKeyword(businessName);
  let pendingAuditId: string | undefined;

  try {
    pendingAuditId = await createPendingAudit(supabase, {
      targetUrl: request.website_url,
      keyword,
      businessName,
    });

    const result = await runResearchAgent({
      targetUrl: request.website_url,
      keyword,
      businessName,
    });

    await supabase.from('site_audits').delete().eq('id', pendingAuditId);

    const { auditId } = await saveAuditToSupabase(supabase, result);

    const reportSummary = await buildVisitorReportSummary({
      businessName,
      websiteUrl: request.website_url,
      summary: result.audit.summary ?? '',
      recommendations: result.audit.recommendations ?? '',
      findings: result.findings.map((f) => ({
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
      })),
    });

    await supabase
      .from('audit_requests')
      .update({
        status: 'completed',
        site_audit_id: auditId,
        report_summary: reportSummary,
      })
      .eq('id', requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed';

    if (pendingAuditId) {
      await markAuditFailed(supabase, pendingAuditId, message);
    }

    await supabase
      .from('audit_requests')
      .update({
        status: 'failed',
        report_summary: 'We could not complete your audit. Please try again later or contact support.',
      })
      .eq('id', requestId);
  }
}
