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

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? trimmed).trim();
}

function insightLine(lead: OutreachLead): string {
  if (lead.recommendation) {
    return firstSentence(lead.recommendation);
  }

  if (lead.website_url) {
    return `You're close on "${lead.keyword}" — a tighter homepage title and a few on-page fixes could push you up.`;
  }

  return `You're ranking without much web presence — a simple landing page plus Google Business Profile work could move you up.`;
}

export function buildOutreachEmail(lead: OutreachLead): OutreachEmail {
  const subject = `Quick note on "${lead.keyword}" — you're #${lead.rank_position}`;
  const body = [
    'Hi there,',
    '',
    `I noticed ${lead.business_name} at #${lead.rank_position} for "${lead.keyword}" in ${lead.location}. ${insightLine(lead)}`,
    '',
    'Happy to send a free audit — want it?',
  ].join('\n');

  const full = `Subject: ${subject}\n\n${body}`;

  return { subject, body, full };
}
