import { ApiSpendCapExceededError, assertWithinBudget } from '@/lib/cost/check';
import { recordApiUsage } from '@/lib/cost/tracker';
import {
  getAppBaseUrl,
  getResendApiKey,
  getResendFromEmail,
  getResendReplyToEmail,
} from '@/lib/env';

export interface SendOutreachEmailParams {
  to: string;
  subject: string;
  body: string;
  businessName: string;
  /** When true, prepends a banner that this is a draft for manual forwarding. */
  testMode?: boolean;
  /** Optional lead specifics — power the glam header pill, headline, and CTA. */
  keyword?: string | null;
  rankPosition?: number | null;
  location?: string | null;
  /** Where the CTA button points. Defaults to the app's free-audit homepage. */
  ctaUrl?: string | null;
  ctaLabel?: string | null;
}

export async function sendOutreachEmail(params: SendOutreachEmailParams): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

  try {
    await assertWithinBudget('resend');
  } catch (error) {
    if (error instanceof ApiSpendCapExceededError) {
      console.warn('[email] Resend spend cap reached');
      throw error;
    }
    throw error;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getResendFromEmail(),
        to: params.to,
        reply_to: getResendReplyToEmail(),
        subject: params.subject,
        text: params.body,
        html: buildOutreachEmailHtml(params),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[email] Resend outreach failed:', response.status, body);
      return false;
    }

    await recordApiUsage({
      provider: 'resend',
      operation: 'send_email',
      units: 1,
      metadata: { type: 'outreach', testMode: params.testMode ?? false },
    });

    return true;
  } catch (error) {
    console.error('[email] sendOutreachEmail failed:', error);
    return false;
  }
}

// ── Glam HTML email ──────────────────────────────────────────────────────────
// Email clients (Gmail, Outlook, Apple Mail) strip <style> blocks, flexbox, and
// modern CSS — so this is table-based with inline styles only. Gradients degrade
// to a solid bgcolor in Outlook. Keep it bulletproof, not clever.

const BRAND = {
  teal: '#0d9488',
  tealDark: '#0f766e',
  tealLight: '#14b8a6',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  canvas: '#eef2f7',
  card: '#ffffff',
};

function buildOutreachEmailHtml(params: SendOutreachEmailParams): string {
  const { body, businessName, testMode, keyword, rankPosition, location } = params;

  const replyTo = stripAngle(getResendReplyToEmail());
  const ctaUrl = (params.ctaUrl ?? '').trim() || getAppBaseUrl();
  const ctaLabel = (params.ctaLabel ?? '').trim() || 'Get your free audit →';

  const preheader = keyword
    ? `You're not #1 for “${keyword}” — quick note for ${businessName}.`
    : `A quick, free SEO win for ${businessName}.`;

  const headline =
    keyword
      ? `You're not #1 for “${escapeHtml(keyword)}”`
      : `A quick win for ${escapeHtml(businessName)}`;

  const subhead = location
    ? `${escapeHtml(businessName)} · ${escapeHtml(location)}`
    : escapeHtml(businessName);

  const rankPill =
    rankPosition != null && rankPosition > 1
      ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.02em;">Not&nbsp;#1&nbsp;·&nbsp;#${rankPosition}</span>`
      : keyword
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.02em;">Not&nbsp;#1</span>`
        : '';

  const testBanner = testMode
    ? `<tr><td style="padding:0 0 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td style="padding:12px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;color:#92400e;font-size:13px;line-height:1.5;">
            <strong>Draft outreach</strong> — intended for <strong>${escapeHtml(businessName)}</strong>. Forward manually once you have their contact email.
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const paragraphs = body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(
      (line) =>
        `<p style="margin:0 0 14px;color:${BRAND.body};font-size:16px;line-height:1.65;">${escapeHtml(line)}</p>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <title>SynapseCRO</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BRAND.canvas};">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:600px;max-width:100%;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">

          <!-- Gradient header -->
          <tr>
            <td bgcolor="${BRAND.teal}" style="background:${BRAND.teal};background:linear-gradient(135deg,${BRAND.tealLight} 0%,${BRAND.teal} 55%,${BRAND.tealDark} 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-size:15px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-transform:uppercase;">Synapse<span style="color:rgba(255,255,255,0.72);">CRO</span></td>
                  <td align="right">${rankPill}</td>
                </tr>
              </table>
              <div style="margin:20px 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;">${headline}</div>
              <div style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.82);">${subhead}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${testBanner}
                <tr><td>
                  ${paragraphs}

                  <!-- CTA button (bulletproof) -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:24px 0 8px;">
                    <tr>
                      <td bgcolor="${BRAND.teal}" style="border-radius:12px;background:${BRAND.teal};">
                        <a href="${escapeAttr(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(ctaLabel)}</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:6px 0 0;font-size:13px;color:${BRAND.muted};">Or just hit reply — it comes straight to me.</p>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px;background:#f8fafc;border-top:1px solid ${BRAND.line};">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                Sent by <strong style="color:${BRAND.body};">SynapseCRO</strong> — we help local businesses climb from page-1-bottom to the top spots.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:${BRAND.faint};">
                Replies go to ${escapeHtml(replyTo)}. Not relevant? Reply “no thanks” and I won't email again.
              </p>
            </td>
          </tr>

        </table>
        <div style="height:24px;line-height:24px;">&nbsp;</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** For href/attribute contexts — also neutralises single quotes. */
function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

/** "SynapseCRO <ram@x.dev>" → "ram@x.dev" for display. */
function stripAngle(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}
