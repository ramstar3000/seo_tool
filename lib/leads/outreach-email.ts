import type { Lead } from '@/lib/leads/types';

export interface OutreachEmail {
  subject: string;
  body: string;
  /** Subject line followed by blank line and body — ready to paste into an email client. */
  full: string;
}

type OutreachLead = Pick<
  Lead,
  'business_name' | 'location' | 'keyword' | 'rank_position' | 'website_url' | 'recommendation'
>;

function insightLine(lead: OutreachLead): string {
  if (lead.recommendation?.trim()) {
    return lead.recommendation.trim();
  }

  if (lead.website_url) {
    return `You're not #1 for "${lead.keyword}" in ${lead.location} — a tighter homepage title could move you up.`;
  }

  return `You're ranking without much web presence — a simple landing page plus Google Business Profile work could move you up.`;
}

export function buildOutreachEmail(lead: OutreachLead): OutreachEmail {
  const subject = `You're not #1 for "${lead.keyword}" — ${lead.location}`;
  const body = [
    'Hi there,',
    '',
    `Quick check on "${lead.keyword}" in ${lead.location}: ${insightLine(lead)}`,
    '',
    'Happy to send a free full audit — want it?',
  ].join('\n');

  const full = `Subject: ${subject}\n\n${body}`;

  return { subject, body, full };
}
