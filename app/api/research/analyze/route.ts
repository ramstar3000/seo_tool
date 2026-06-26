import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { isLightAuditTrace } from '@/lib/leads/is-light-audit';
import { runResearchAgent } from '@/lib/research/agent';
import {
  createPendingAudit,
  findAuditByLeadId,
  markAuditFailed,
  saveAuditToSupabase,
} from '@/lib/research/persist';
import { autoApplyFromAudit } from '@/lib/github/auto-apply-from-audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const analyzeBodySchema = z.object({
  leadId: z.string().uuid().optional(),
  targetUrl: z.string().url().optional(),
  keyword: z.string().min(1).max(200).optional(),
  businessName: z.string().min(1).max(200).optional(),
});

function sanitizeClientError(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[REDACTED]');
}

function clientSafeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Analysis failed';

  if (
    message.includes('not configured') ||
    message.includes('required') ||
    message.includes('Invalid')
  ) {
    return sanitizeClientError(message);
  }

  return 'Site analysis failed. Please try again.';
}

function errorStatus(message: string): number {
  if (message.includes('not configured')) return 503;
  if (message.includes('required') || message.includes('Invalid')) return 400;
  return 500;
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let auditId: string | undefined;

  try {
    const body = analyzeBodySchema.parse(await request.json());

    let targetUrl = body.targetUrl;
    let keyword = body.keyword;
    let businessName = body.businessName;
    const leadId = body.leadId;

    let location = 'London';

    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      if (!lead.website_url) {
        return NextResponse.json({ error: 'Lead has no website URL' }, { status: 400 });
      }

      targetUrl = lead.website_url;
      keyword = keyword ?? lead.keyword;
      businessName = businessName ?? lead.business_name;
      location = lead.location ?? 'London';

      const existing = await findAuditByLeadId(supabase, leadId);
      if (existing?.status === 'completed' && !isLightAuditTrace(existing.tool_trace)) {
        return NextResponse.json({ auditId: existing.id, existing: true });
      }
    }

    if (!targetUrl || !keyword || !businessName) {
      return NextResponse.json(
        { error: 'targetUrl, keyword, and businessName are required' },
        { status: 400 }
      );
    }

    auditId = await createPendingAudit(supabase, {
      leadId,
      targetUrl,
      keyword,
      businessName,
    });

    const result = await runResearchAgent({
      targetUrl,
      keyword,
      businessName,
      location,
      leadId,
    });

    await supabase.from('site_audits').delete().eq('id', auditId);

    const { auditId: savedId } = await saveAuditToSupabase(supabase, result);

    if (leadId) {
      void autoApplyFromAudit({
        supabase,
        auditId: savedId,
        leadId,
      }).catch((err) => {
        console.error('[research/analyze] auto-PR failed:', err);
      });
    }

    return NextResponse.json({ auditId: savedId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';

    if (auditId && supabase) {
      await markAuditFailed(supabase, auditId, clientSafeMessage(error));
    }

    return NextResponse.json(
      { error: clientSafeMessage(error) },
      { status: errorStatus(message) }
    );
  }
}
