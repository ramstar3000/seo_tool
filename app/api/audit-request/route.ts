import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, apiNotConfigured } from '@/lib/api/errors';
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
    return apiNotConfigured('Supabase');
  }

  let body: z.infer<typeof auditRequestBodySchema>;
  try {
    body = auditRequestBodySchema.parse(await request.json());
  } catch {
    return apiError('Valid email and website URL are required', 400, 'VALIDATION_ERROR');
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
    console.error('[audit-request] insert failed:', error?.code, error?.message);
    if (error?.code === 'PGRST205') {
      return apiError(
        'Database schema not applied. Run supabase/schema.sql in your Supabase SQL editor.',
        503,
        'SCHEMA_NOT_READY'
      );
    }
    return apiError('Failed to create audit request', 500, 'DB_ERROR');
  }

  const requestId = data.id as string;

  void processAuditRequest(requestId);

  return NextResponse.json({
    id: requestId,
    status: 'pending',
    auditUrl: `/audit/${requestId}`,
  });
}
