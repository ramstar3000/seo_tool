import { NextRequest, NextResponse } from 'next/server';
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

  const { data, error } = await supabase
    .from('audit_requests')
    .select('id, email, website_url, business_name, status, site_audit_id, report_summary, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Audit request not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    email: data.email,
    websiteUrl: data.website_url,
    businessName: data.business_name,
    status: data.status,
    reportSummary: data.report_summary,
    createdAt: data.created_at,
    researchUrl: data.site_audit_id ? `/research/${data.site_audit_id}` : null,
    siteAuditId: data.site_audit_id,
  });
}
