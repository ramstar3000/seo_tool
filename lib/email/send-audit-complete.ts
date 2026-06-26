import { ApiSpendCapExceededError, assertWithinBudget } from '@/lib/cost/check';
import { recordApiUsage } from '@/lib/cost/tracker';
import { scoreLabel } from '@/lib/audit/score';
import {
  groupFindingsByAction,
  type ActionableFinding,
} from '@/lib/email/finding-actionability';
import { getAppBaseUrl, getResendApiKey, getResendFromEmail } from '@/lib/env';

export interface SendAuditCompleteParams {
  to: string;
  businessName: string;
  auditRequestId: string;
  websiteUrl?: string;
  score?: number;
  reportSummary?: string;
  findings?: ActionableFinding[];
}

export async function sendAuditCompleteEmail(params: SendAuditCompleteParams): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

  const auditUrl = `${getAppBaseUrl()}/audit/${params.auditRequestId}`;
  const name = params.businessName || 'there';
  const findings = params.findings ?? [];
  const grouped = groupFindingsByAction(findings);
  const score = params.score;
  const scoreText =
    score !== undefined ? `${score}/100 — ${scoreLabel(score).label}` : null;

  const topFindings = [...findings]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 5);

  try {
    await assertWithinBudget('resend');
  } catch (error) {
    if (error instanceof ApiSpendCapExceededError) {
      console.warn('[email] Resend spend cap reached; audit email not sent');
      return false;
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
        subject: buildSubject(params.businessName, score),
        html: buildAuditEmailHtml({
          name,
          auditUrl,
          websiteUrl: params.websiteUrl,
          scoreText,
          reportSummary: params.reportSummary,
          topFindings,
          grouped,
        }),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[email] Resend failed:', response.status, body);
      return false;
    }

    await recordApiUsage({
      provider: 'resend',
      operation: 'send_email',
      units: 1,
      metadata: { type: 'audit_complete', auditRequestId: params.auditRequestId },
    });

    return true;
  } catch (error) {
    console.error('[email] sendAuditComplete failed:', error);
    return false;
  }
}

function buildSubject(businessName: string, score?: number): string {
  const label = businessName?.trim() || 'Your site';
  if (score !== undefined && score < 50) {
    return `${label}: your audit found ${score}/100 — fixes inside`;
  }
  return `${label}: your SynapseCRO audit is ready`;
}

function buildAuditEmailHtml(params: {
  name: string;
  auditUrl: string;
  websiteUrl?: string;
  scoreText: string | null;
  reportSummary?: string;
  topFindings: ActionableFinding[];
  grouped: ReturnType<typeof groupFindingsByAction>;
}): string {
  const {
    name,
    auditUrl,
    websiteUrl,
    scoreText,
    reportSummary,
    topFindings,
    grouped,
  } = params;

  const summaryBlock = reportSummary
    ? `<p style="margin:0 0 16px;color:#334155;line-height:1.6;">${escapeHtml(reportSummary.slice(0, 600))}${reportSummary.length > 600 ? '…' : ''}</p>`
    : '';

  const scoreBlock = scoreText
    ? `<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f172a;">Website health score: ${escapeHtml(scoreText)}</p>`
    : '';

  const findingsBlock =
    topFindings.length > 0
      ? `<ul style="margin:0 0 20px;padding-left:20px;color:#334155;line-height:1.6;">
          ${topFindings
            .map(
              (f) =>
                `<li style="margin-bottom:8px;"><strong>${escapeHtml(f.title)}</strong> — ${escapeHtml(f.description.slice(0, 180))}${f.description.length > 180 ? '…' : ''}</li>`
            )
            .join('')}
        </ul>`
      : '';

  const actionSection = buildActionSection(grouped);

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    <p style="margin:0 0 12px;color:#0f172a;font-size:16px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6;">
      Your free website audit is complete${websiteUrl ? ` for <strong>${escapeHtml(websiteUrl)}</strong>` : ''}.
      We scanned your site, checked competitors, and reviewed your online presence.
    </p>
    ${scoreBlock}
    ${summaryBlock}
    ${findingsBlock.length > 0 ? `<p style="margin:0 0 8px;font-weight:600;color:#0f172a;">Top issues we found</p>${findingsBlock}` : ''}
    ${actionSection}
    <p style="margin:24px 0 16px;">
      <a href="${auditUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
        View full audit report
      </a>
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">
      Link your GitHub repo in SynapseCRO and we can open a pull request with SEO fixes for the items marked as code-fixable.
    </p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">— SynapseCRO</p>
  </div>
</body>
</html>`.trim();
}

function buildActionSection(grouped: ReturnType<typeof groupFindingsByAction>): string {
  const sections: string[] = [];

  if (grouped.automated.length > 0) {
    sections.push(
      renderActionList(
        'We can fix these in code (link your repo)',
        grouped.automated.slice(0, 4),
        '#059669'
      )
    );
  }

  if (grouped.semiAuto.length > 0) {
    sections.push(
      renderActionList(
        'Quick wins — we can draft copy for you',
        grouped.semiAuto.slice(0, 3),
        '#d97706'
      )
    );
  }

  if (grouped.manual.length > 0) {
    sections.push(
      renderActionList(
        'Your action items',
        grouped.manual.slice(0, 4),
        '#64748b'
      )
    );
  }

  if (sections.length === 0) return '';

  return `<div style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">What happens next</p>
    ${sections.join('')}
  </div>`;
}

function renderActionList(
  heading: string,
  items: ActionableFinding[],
  color: string
): string {
  if (items.length === 0) return '';

  return `<div style="margin-bottom:12px;">
    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:${color};">${escapeHtml(heading)}</p>
    <ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;line-height:1.5;">
      ${items.map((f) => `<li style="margin-bottom:4px;">${escapeHtml(f.title)}</li>`).join('')}
    </ul>
  </div>`;
}

function severityRank(severity: string): number {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
