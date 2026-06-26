import { getResendApiKey, getResendFromEmail } from '@/lib/env';

export interface SendOutreachEmailParams {
  to: string;
  subject: string;
  body: string;
  businessName: string;
  /** When true, prepends a banner that this is a draft for manual forwarding. */
  testMode?: boolean;
}

export async function sendOutreachEmail(params: SendOutreachEmailParams): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

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

    return true;
  } catch (error) {
    console.error('[email] sendOutreachEmail failed:', error);
    return false;
  }
}

function buildOutreachEmailHtml(params: SendOutreachEmailParams): string {
  const { body, businessName, testMode } = params;

  const testBanner = testMode
    ? `<div style="margin:0 0 20px;padding:12px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;color:#92400e;font-size:14px;line-height:1.5;">
        <strong>Draft outreach</strong> — intended for <strong>${escapeHtml(businessName)}</strong>.
        Forward manually once you have their contact email.
      </div>`
    : '';

  const paragraphs = body
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? '<p style="margin:0 0 12px;">&nbsp;</p>'
        : `<p style="margin:0 0 12px;color:#334155;line-height:1.6;">${escapeHtml(line)}</p>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    ${testBanner}
    ${paragraphs}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">— SynapseCRO</p>
  </div>
</body>
</html>`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
