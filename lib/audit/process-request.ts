import type { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { RESEARCH_AGENT_MODEL } from '@/lib/anthropic/client';
import { runResearchAgent } from '@/lib/research/agent';
import {
  buildVisitorAuditUserPrompt,
  VISITOR_AUDIT_SYSTEM_PROMPT,
} from '@/lib/prompts/visitor-audit';
import {
  createPendingAudit,
  findAuditByLeadId,
  getAuditById,
  markAuditFailed,
  saveAuditToSupabase,
} from '@/lib/research/persist';

export interface RunLeadAuditParams {
  leadId: string;
  targetUrl: string;
  keyword: string;
  businessName: string;
  location?: string;
}

export async function runAndPersistLeadAudit(
  supabase: SupabaseClient,
  params: RunLeadAuditParams,
  options?: { force?: boolean }
): Promise<string> {
  const existing = await findAuditByLeadId(supabase, params.leadId);
  if (!options?.force && existing?.status === 'completed') {
    return existing.id;
  }

  const pendingId = await createPendingAudit(supabase, {
    leadId: params.leadId,
    targetUrl: params.targetUrl,
    keyword: params.keyword,
    businessName: params.businessName,
  });

  try {
    const result = await runResearchAgent({
      targetUrl: params.targetUrl,
      keyword: params.keyword,
      businessName: params.businessName,
      location: params.location ?? 'London',
      leadId: params.leadId,
    });

    await supabase.from('site_audits').delete().eq('id', pendingId);

    const { auditId } = await saveAuditToSupabase(supabase, result);

    await supabase
      .from('leads')
      .update({ last_audit_id: auditId, updated_at: new Date().toISOString() })
      .eq('id', params.leadId);

    return auditId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed';
    await markAuditFailed(supabase, pendingId, message);
    throw error;
  }
}

export async function shouldSkipLeadAudit(
  supabase: SupabaseClient,
  leadId: string
): Promise<boolean> {
  const existing = await findAuditByLeadId(supabase, leadId);
  return existing?.status === 'completed';
}

async function generateVisitorSummary(
  businessName: string,
  websiteUrl: string,
  summary: string,
  recommendations: string,
  topFindings: Array<{ severity: string; title: string; description: string }>
): Promise<string> {
  try {
    const { text } = await generateText({
      model: anthropic(RESEARCH_AGENT_MODEL),
      system: VISITOR_AUDIT_SYSTEM_PROMPT,
      prompt: buildVisitorAuditUserPrompt({
        businessName,
        websiteUrl,
        executiveSummary: summary,
        recommendations,
        findings: topFindings.map((f) => ({ ...f, category: 'general' })),
      }),
    });
    return text.trim();
  } catch {
    return [
      `Thanks for requesting a free audit for ${businessName}!`,
      '',
      summary,
      '',
      'Top recommendations:',
      recommendations,
    ].join('\n');
  }
}

export async function processVisitorAuditRequest(
  supabase: SupabaseClient,
  requestId: string
): Promise<void> {
  const { data: request, error: fetchError } = await supabase
    .from('audit_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) return;

  if (request.status === 'completed' || request.status === 'processing') return;

  await supabase
    .from('audit_requests')
    .update({ status: 'processing' })
    .eq('id', requestId);

  const businessName = (request.business_name as string | null) ?? new URL(request.website_url as string).hostname;
  const keyword = `${businessName} local business`;
  const targetUrl = request.website_url as string;

  let pendingId: string | undefined;

  try {
    pendingId = await createPendingAudit(supabase, {
      targetUrl,
      keyword,
      businessName,
    });

    const result = await runResearchAgent({
      targetUrl,
      keyword,
      businessName,
      location: 'London',
    });

    await supabase.from('site_audits').delete().eq('id', pendingId);
    pendingId = undefined;

    const { auditId } = await saveAuditToSupabase(supabase, result);

    const topFindings = result.findings.slice(0, 5).map((f) => ({
      severity: f.severity,
      title: f.title,
      description: f.description,
    }));

    const reportSummary = await generateVisitorSummary(
      businessName,
      targetUrl,
      result.audit.summary ?? '',
      result.audit.recommendations ?? '',
      topFindings
    );

    await supabase
      .from('audit_requests')
      .update({
        status: 'completed',
        site_audit_id: auditId,
        report_summary: reportSummary,
        error_message: null,
      })
      .eq('id', requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed';

    if (pendingId) {
      await markAuditFailed(supabase, pendingId, message);
    }

    await supabase
      .from('audit_requests')
      .update({
        status: 'failed',
        error_message: message,
        report_summary: `We couldn't complete your audit right now. Please try again later.`,
      })
      .eq('id', requestId);
  }
}

export async function getVisitorAuditDetail(
  supabase: SupabaseClient,
  requestId: string
): Promise<{
  id: string;
  email: string;
  website_url: string;
  business_name: string | null;
  status: string;
  report_summary: string | null;
  site_audit_id: string | null;
  lead_id?: string | null;
  error_message?: string | null;
  created_at: string;
  findings?: Array<{ severity: string; title: string; description: string; category: string }>;
} | null> {
  const { data: request } = await supabase
    .from('audit_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return null;

  const base = {
    id: request.id as string,
    email: request.email as string,
    website_url: request.website_url as string,
    business_name: (request.business_name as string | null) ?? null,
    status: request.status as string,
    report_summary: (request.report_summary as string | null) ?? null,
    site_audit_id: (request.site_audit_id as string | null) ?? null,
    lead_id: (request.lead_id as string | null) ?? null,
    error_message: (request.error_message as string | null) ?? null,
    created_at: request.created_at as string,
  };

  if (request.site_audit_id && request.status === 'completed') {
    const audit = await getAuditById(supabase, request.site_audit_id as string);
    if (audit) {
      return {
        ...base,
        findings: audit.findings.slice(0, 8).map((f) => ({
          severity: f.severity,
          title: f.title,
          description: f.description,
          category: f.category,
        })),
      };
    }
  }

  return base;
}
