import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiSpendCapExceededError } from '@/lib/cost/check';
import { sendOutreachEmail } from '@/lib/email/send-outreach-email';
import { getOutreachTargetEmail } from '@/lib/env';
import { buildOutreachEmail } from '@/lib/leads/outreach-email';
import type { Lead } from '@/lib/leads/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const OUTREACH_BATCH_DEFAULT = 5;
export const OUTREACH_BATCH_MAX = 10;
export const OUTREACH_BATCH_DELAY_MS = 600;

export interface OutreachRecipient {
  to: string;
  testMode: boolean;
}

export type SendOutreachResult =
  | { success: true; testMode: boolean; to: string; subject: string; lead: Lead }
  | { success: false; error: string };

export function resolveOutreachRecipient(options?: {
  prospectEmail?: string | null;
  overrideTo?: string | null;
}): OutreachRecipient | { error: string } {
  const override = options?.overrideTo?.trim();
  if (override) {
    if (!EMAIL_REGEX.test(override)) return { error: 'Invalid email address' };
    return { to: override, testMode: false };
  }

  const prospect = options?.prospectEmail?.trim();
  if (prospect) {
    if (!EMAIL_REGEX.test(prospect)) return { error: 'Invalid prospect email' };
    return { to: prospect, testMode: false };
  }

  const target = getOutreachTargetEmail();
  if (target) {
    if (!EMAIL_REGEX.test(target)) return { error: 'OUTREACH_TARGET_EMAIL is invalid' };
    return { to: target, testMode: true };
  }

  return {
    error:
      'Leads have no prospect email. Set OUTREACH_TARGET_EMAIL for test sends, or pass "to" in the request body.',
  };
}

export function appendOutreachNote(
  existingNotes: string | null,
  details: { testMode: boolean; to: string; businessName: string }
): string {
  const ts = new Date().toISOString();
  const destination = details.testMode ? `test inbox ${details.to}` : details.to;
  const line = `[${ts}] Outreach sent for ${details.businessName} → ${destination}`;
  return existingNotes ? `${existingNotes}\n${line}` : line;
}

export async function sendOutreachForLead(
  supabase: SupabaseClient,
  lead: Lead,
  options?: { overrideTo?: string | null; prospectEmail?: string | null }
): Promise<SendOutreachResult> {
  const recipient = resolveOutreachRecipient({
    overrideTo: options?.overrideTo,
    prospectEmail: options?.prospectEmail,
  });

  if ('error' in recipient) {
    return { success: false, error: recipient.error };
  }

  const email = buildOutreachEmail(lead);
  const subject = recipient.testMode
    ? `[DRAFT: ${lead.business_name}] ${email.subject}`
    : email.subject;

  let sent: boolean;
  try {
    sent = await sendOutreachEmail({
      to: recipient.to,
      subject,
      body: email.body,
      businessName: lead.business_name,
      testMode: recipient.testMode,
      keyword: lead.keyword,
      rankPosition: lead.rank_position,
      location: lead.location,
    });
  } catch (error) {
    if (error instanceof ApiSpendCapExceededError) {
      return {
        success: false,
        error: `Email send blocked: Resend spend cap reached ($${error.spentUsd.toFixed(2)} / $${error.capUsd.toFixed(2)}).`,
      };
    }
    throw error;
  }

  if (!sent) {
    return {
      success: false,
      error: 'Failed to send email. Check RESEND_API_KEY and RESEND_FROM_EMAIL.',
    };
  }

  const notes = appendOutreachNote(lead.notes, {
    testMode: recipient.testMode,
    to: recipient.to,
    businessName: lead.business_name,
  });

  const { data: updated, error } = await supabase
    .from('leads')
    .update({
      status: 'contacted',
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .select('*')
    .single();

  if (error || !updated) {
    return { success: false, error: 'Email sent but failed to update lead status' };
  }

  return {
    success: true,
    testMode: recipient.testMode,
    to: recipient.to,
    subject,
    lead: updated as Lead,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
