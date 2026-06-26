import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAuditInsights } from '@/lib/clickhouse/seo-insights';
import { extractPageSpeedFromTrace } from '@/lib/research/pagespeed';
import type {
  AuditCompetitor,
  AuditDetail,
  AuditFinding,
  AuditPage,
  AuditSocialProfile,
  ResearchAgentResult,
  SiteAudit,
  SocialPresenceSnapshot,
  ToolTraceEntry,
} from '@/lib/research/types';
import { getPlatformById } from '@/lib/research/social-platforms';

export interface SavedAudit {
  auditId: string;
}

export async function saveAuditToSupabase(
  supabase: SupabaseClient,
  result: ResearchAgentResult
): Promise<SavedAudit> {
  const { audit, competitors, pages, findings, socialProfiles, toolTrace } = result;

  const { data: auditRow, error: auditError } = await supabase
    .from('site_audits')
    .insert({
      lead_id: audit.lead_id,
      target_url: audit.target_url,
      keyword: audit.keyword,
      business_name: audit.business_name,
      status: audit.status,
      summary: audit.summary,
      recommendations: audit.recommendations,
      tool_trace: toolTrace,
      completed_at: audit.completed_at,
    })
    .select('id')
    .single();

  if (auditError || !auditRow) {
    throw new Error(auditError?.message ?? 'Failed to save audit');
  }

  const auditId = auditRow.id as string;

  if (competitors.length > 0) {
    const { error } = await supabase.from('audit_competitors').insert(
      competitors.map((c) => ({
        audit_id: auditId,
        rank_position: c.rank_position,
        business_name: c.business_name,
        url: c.url,
        title: c.title,
        snippet: c.snippet,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (pages.length > 0) {
    const { error } = await supabase.from('audit_pages').insert(
      pages.map((p) => ({
        audit_id: auditId,
        url: p.url,
        is_target: p.is_target,
        page_type: p.page_type,
        seo_json: p.seo_json,
        scraped_at: p.scraped_at,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (findings.length > 0) {
    const { error } = await supabase.from('audit_findings').insert(
      findings.map((f) => ({
        audit_id: auditId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        evidence: f.evidence ?? null,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (socialProfiles.length > 0) {
    const { error } = await supabase.from('audit_social_profiles').insert(
      socialProfiles.map((p) => ({
        audit_id: auditId,
        platform_id: p.platform_id,
        profile_url: p.profile_url,
        bio_text: p.bio_text,
        seo_json: p.seo_json,
        found_via: p.found_via,
        status: p.status,
      }))
    );
    if (error) throw new Error(error.message);
  }

  let rankPosition: number | null = null;
  if (audit.lead_id) {
    const { data: leadRow } = await supabase
      .from('leads')
      .select('rank_position')
      .eq('id', audit.lead_id)
      .maybeSingle();
    if (leadRow?.rank_position != null) {
      rankPosition = Number(leadRow.rank_position);
    }
  }

  void recordAuditInsights({
    auditId,
    audit,
    findings,
    rankPosition,
    lcpMs: extractPageSpeedFromTrace(toolTrace)?.lcpMs ?? null,
    competitorCount: competitors.length > 0 ? competitors.length : null,
  });

  return { auditId };
}

export type { AuditDetail };

export async function getAuditById(
  supabase: SupabaseClient,
  id: string
): Promise<AuditDetail | null> {
  const { data: audit, error } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !audit) return null;

  const [competitorsRes, pagesRes, findingsRes, socialRes] = await Promise.all([
    supabase.from('audit_competitors').select('*').eq('audit_id', id).order('rank_position'),
    supabase.from('audit_pages').select('*').eq('audit_id', id).order('scraped_at'),
    supabase
      .from('audit_findings')
      .select('*')
      .eq('audit_id', id)
      .order('severity'),
    supabase.from('audit_social_profiles').select('*').eq('audit_id', id),
  ]);

  const socialProfiles = ((socialRes.data ?? []) as Array<AuditSocialProfile & { id: string }>).map(
    (p) => ({
      ...p,
      platform_name: getPlatformById(p.platform_id)?.name ?? p.platform_id,
    })
  );

  const socialFindings = ((findingsRes.data ?? []) as Array<AuditFinding & { id: string }>).filter(
    (f) => f.category === 'social'
  );

  const socialPresence: SocialPresenceSnapshot | null =
    socialProfiles.length > 0
      ? {
          profiles: socialProfiles.map((p) => ({
            ...p,
            platform_name: p.platform_name ?? p.platform_id,
          })),
          searched: socialProfiles.some((p) => p.status !== 'not_searched'),
          inconsistencies: socialFindings.map((f) => ({
            type: f.title,
            platforms: (f.evidence?.platforms as string[] | undefined) ?? [],
            description: f.description,
            recommendation: (f.evidence?.recommendation as string | undefined) ?? '',
          })),
        }
      : null;

  return {
    ...(audit as SiteAudit),
    competitors: (competitorsRes.data ?? []) as Array<AuditCompetitor & { id: string }>,
    pages: (pagesRes.data ?? []) as Array<AuditPage & { id: string }>,
    findings: (findingsRes.data ?? []) as Array<AuditFinding & { id: string }>,
    socialProfiles,
    socialPresence,
    pageSpeed: extractPageSpeedFromTrace((audit.tool_trace as ToolTraceEntry[]) ?? []),
  };
}

export async function listRecentAudits(
  supabase: SupabaseClient,
  limit = 20
): Promise<SiteAudit[]> {
  const { data, error } = await supabase
    .from('site_audits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as SiteAudit[];
}

export async function findAuditByLeadId(
  supabase: SupabaseClient,
  leadId: string
): Promise<SiteAudit | null> {
  const { data, error } = await supabase
    .from('site_audits')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as SiteAudit) ?? null;
}

export async function createPendingAudit(
  supabase: SupabaseClient,
  params: {
    leadId?: string;
    targetUrl: string;
    keyword: string;
    businessName: string;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('site_audits')
    .insert({
      lead_id: params.leadId ?? null,
      target_url: params.targetUrl,
      keyword: params.keyword,
      business_name: params.businessName,
      status: 'running',
      tool_trace: [],
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create audit');
  }

  return data.id as string;
}

export async function markAuditFailed(
  supabase: SupabaseClient,
  auditId: string,
  message: string
): Promise<void> {
  await supabase
    .from('site_audits')
    .update({
      status: 'failed',
      summary: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId);
}

export async function getSocialSummaryByLeadId(
  supabase: SupabaseClient,
  leadId: string
): Promise<SocialPresenceSnapshot | null> {
  const audit = await findAuditByLeadId(supabase, leadId);
  if (!audit) return null;

  const detail = await getAuditById(supabase, audit.id);
  return detail?.socialPresence ?? null;
}

export async function persistResearchAudit(
  supabase: SupabaseClient,
  audit: Omit<SiteAudit, 'id' | 'created_at'>,
  competitors: AuditCompetitor[],
  pages: AuditPage[],
  findings: AuditFinding[],
  toolTrace: ToolTraceEntry[],
  socialProfiles: AuditSocialProfile[] = []
): Promise<SavedAudit> {
  return saveAuditToSupabase(supabase, {
    audit,
    competitors,
    pages,
    findings,
    socialProfiles,
    toolTrace,
  });
}
