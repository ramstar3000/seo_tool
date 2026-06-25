import { NextRequest, NextResponse } from 'next/server';
import { computeAuditScore } from '@/lib/audit/score';
import { getVisitorAuditDetail } from '@/lib/audit/process-request';
import { getAuditById } from '@/lib/research/persist';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id } = await context.params;
  const detail = await getVisitorAuditDetail(supabase, id);

  if (!detail) {
    return NextResponse.json({ error: 'Audit request not found' }, { status: 404 });
  }

  const { data: requestRow } = await supabase
    .from('audit_requests')
    .select('error_message')
    .eq('id', id)
    .maybeSingle();

  const findings = detail.findings ?? [];
  let score: number | null = null;
  let competitors: Array<{ rank_position: number; business_name: string; url: string }> = [];
  let socialProfiles: Array<{
    platform_id: string;
    platform_name: string;
    status: string;
    profile_url: string | null;
  }> = [];
  let pageSpeed = null;

  if (detail.site_audit_id && detail.status === 'completed') {
    const audit = await getAuditById(supabase, detail.site_audit_id);
    if (audit) {
      score = computeAuditScore(audit.findings);
      competitors = audit.competitors.slice(0, 5).map((c) => ({
        rank_position: c.rank_position,
        business_name: c.business_name,
        url: c.url,
      }));
      socialProfiles = audit.socialProfiles.map((p) => ({
        platform_id: p.platform_id,
        platform_name: p.platform_name ?? p.platform_id,
        status: p.status,
        profile_url: p.profile_url,
      }));
      pageSpeed = audit.pageSpeed;
    }
  }

  return NextResponse.json({
    id: detail.id,
    email: detail.email,
    websiteUrl: detail.website_url,
    businessName: detail.business_name,
    status: detail.status,
    reportSummary: detail.report_summary,
    errorMessage: (requestRow?.error_message as string | null) ?? null,
    createdAt: detail.created_at,
    researchUrl: detail.site_audit_id ? `/research/${detail.site_audit_id}` : null,
    siteAuditId: detail.site_audit_id,
    auditId: detail.site_audit_id,
    score,
    findings,
    competitors,
    socialProfiles,
    leadId: detail.lead_id ?? null,
    addedToPipeline: Boolean(detail.lead_id),
    pageSpeed,
  });
}
