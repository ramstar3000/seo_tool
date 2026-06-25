import type { SupabaseClient } from '@supabase/supabase-js';
import { inferKeywordFromWebsite } from '@/lib/leads/infer-keyword';

export interface ConvertAuditToLeadParams {
  email: string;
  websiteUrl: string;
  businessName: string;
  auditId: string;
}

export interface ConvertAuditToLeadResult {
  leadId: string;
  created: boolean;
}

export async function convertAuditRequestToLead(
  supabase: SupabaseClient,
  params: ConvertAuditToLeadParams
): Promise<ConvertAuditToLeadResult | null> {
  const businessName = params.businessName.trim();
  const email = params.email.trim().toLowerCase();
  const websiteUrl = params.websiteUrl.trim();
  const keyword = inferKeywordFromWebsite(websiteUrl, businessName);

  if (!businessName || !email || !websiteUrl) {
    return null;
  }

  const { data: existing } = await supabase
    .from('leads')
    .select('id, status, notes')
    .eq('business_name', businessName)
    .eq('keyword', keyword)
    .maybeSingle();

  const emailNote = `Visitor audit. Email: ${email}`;

  if (existing) {
    const notes = existing.notes?.includes(email)
      ? (existing.notes as string)
      : [existing.notes, emailNote].filter(Boolean).join('\n');

    await supabase
      .from('leads')
      .update({
        website_url: websiteUrl,
        last_audit_id: params.auditId,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    await supabase.from('site_audits').update({ lead_id: existing.id }).eq('id', params.auditId);

    return { leadId: existing.id as string, created: false };
  }

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert({
      business_name: businessName,
      keyword,
      website_url: websiteUrl,
      status: 'new',
      rank_position: 3,
      lead_score: 70,
      notes: emailNote,
      last_audit_id: params.auditId,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return null;
  }

  const leadId = inserted.id as string;

  await supabase.from('site_audits').update({ lead_id: leadId }).eq('id', params.auditId);

  return { leadId, created: true };
}
