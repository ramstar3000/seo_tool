import type { SupabaseClient } from '@supabase/supabase-js';
import type { LightAuditResult } from '@/lib/leads/light-audit';

export async function saveLightAuditToSupabase(
  supabase: SupabaseClient,
  leadId: string,
  result: LightAuditResult
): Promise<{ auditId: string }> {
  const completedAt = new Date().toISOString();

  const { data: auditRow, error: auditError } = await supabase
    .from('site_audits')
    .insert({
      lead_id: leadId,
      target_url: result.targetUrl,
      keyword: result.keyword,
      business_name: result.businessName,
      status: 'completed',
      summary: result.summary,
      recommendations: result.recommendations,
      tool_trace: [
        {
          turn: 0,
          toolName: 'light_serp_scan',
          input: { keyword: result.keyword, location: result.location },
          output: {
            rankPosition: result.rankPosition,
            isFirst: result.isFirst,
            leader: result.leader,
          },
          durationMs: 0,
        },
      ],
      completed_at: completedAt,
    })
    .select('id')
    .single();

  if (auditError || !auditRow) {
    throw new Error(auditError?.message ?? 'Failed to save light audit');
  }

  const auditId = auditRow.id as string;

  if (result.competitors.length > 0) {
    const { error } = await supabase.from('audit_competitors').insert(
      result.competitors.slice(0, 10).map((c) => ({
        audit_id: auditId,
        rank_position: c.position,
        business_name: parseBusinessNameFromTitle(c.title),
        url: c.link,
        title: c.title,
        snippet: c.snippet,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (result.mustDo.length > 0) {
    const { error } = await supabase.from('audit_findings').insert(
      result.mustDo.map((item) => ({
        audit_id: auditId,
        severity: 'critical' as const,
        category: 'competitive' as const,
        title: item.title,
        description: item.description,
        evidence: { mustDo: true },
      }))
    );
    if (error) throw new Error(error.message);
  }

  const { error: leadError } = await supabase
    .from('leads')
    .update({
      recommendation: result.hook,
      last_audit_id: auditId,
      updated_at: completedAt,
    })
    .eq('id', leadId);

  if (leadError) throw new Error(leadError.message);

  return { auditId };
}

function parseBusinessNameFromTitle(title: string): string {
  const separators = [' - ', ' | ', ' – '];
  for (const sep of separators) {
    if (title.includes(sep)) return title.split(sep)[0].trim();
  }
  return title.trim();
}
