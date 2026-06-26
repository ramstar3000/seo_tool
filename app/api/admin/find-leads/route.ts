import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiError } from '@/lib/api/errors';
import { findLocalLeads, buildDraft } from '@/lib/leads/find-local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radius: z.number().int().min(100).max(3000).default(700),
  target: z.number().int().min(1).max(60).default(30),
  place: z.string().max(80).optional(),
  sender: z.string().max(80).default('{{YOUR NAME}}'),
  tool: z.string().max(80).default('{{YOUR TOOL}}'),
  url: z.string().max(200).default('{{your-tool-url}}'),
  calendar: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request body';
    return apiError(msg || 'Invalid request body', 400, 'VALIDATION_ERROR');
  }

  try {
    const leads = await findLocalLeads({
      lat: body.lat,
      lon: body.lon,
      radius: body.radius,
      target: body.target,
    });

    const draftOpts = {
      sender: body.sender,
      tool: body.tool,
      url: body.url,
      calendar: body.calendar,
      place: body.place,
    };

    const results = leads.map((lead) => ({
      ...lead,
      draft: buildDraft(lead, draftOpts),
    }));

    return NextResponse.json({ count: results.length, leads: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lead search failed';
    return apiError(msg, 502, 'LEAD_SEARCH_FAILED');
  }
}
