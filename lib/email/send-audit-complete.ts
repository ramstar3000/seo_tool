import { getAppBaseUrl, getResendApiKey, getResendFromEmail } from '@/lib/env';

export interface SendAuditCompleteParams {
  to: string;
  businessName: string;
  auditRequestId: string;
}

export async function sendAuditCompleteEmail(params: SendAuditCompleteParams): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

  const auditUrl = `${getAppBaseUrl()}/audit/${params.auditRequestId}`;
  const name = params.businessName || 'there';

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
        subject: 'Your SynapseCRO website audit is ready',
        html: `
          <p>Hi ${escapeHtml(name)},</p>
          <p>Your free website audit is complete. We scanned your site, checked competitors, and reviewed your online presence.</p>
          <p><a href="${auditUrl}">View your audit report</a></p>
          <p>— SynapseCRO</p>
        `.trim(),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[email] Resend failed:', response.status, body);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[email] sendAuditComplete failed:', error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
