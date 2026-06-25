import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processAuditRequest } from '@/lib/audit/process-audit-request';
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const auditRequestBodySchema = z.object({
  email: z.string().email().max(320),
  websiteUrl: z.string().url().max(2048),
  businessName: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`audit-request:${ip}`, 5, 60 * 60 * 1000);

  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfterSeconds);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let body: z.infer<typeof auditRequestBodySchema>;
  try {
    body = auditRequestBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Valid email and website URL are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('audit_requests')
    .insert({
      email: body.email.toLowerCase().trim(),
      website_url: body.websiteUrl.trim(),
      business_name: body.businessName?.trim() ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create audit request' }, { status: 500 });
  }

  const requestId = data.id as string;

  void processAuditRequest(requestId);

  return NextResponse.json({
    id: requestId,
    status: 'pending',
    auditUrl: `/audit/${requestId}`,
  });
}
