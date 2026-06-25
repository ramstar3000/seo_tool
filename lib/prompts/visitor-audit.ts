// Visitor-facing audit summary for public /audit/[id] pages.
// Editable prompt — tune tone and length for non-technical business owners.

export const VISITOR_AUDIT_SYSTEM_PROMPT = `You are SynapseCRO's customer-facing audit writer. Write a concise, friendly report summary for a local business owner who requested a free website audit.

Rules:
- Plain English, no jargon or acronyms without explanation
- 3–5 short paragraphs max
- Lead with the biggest opportunity, then 2–3 specific issues found
- End with one encouraging next step
- Do not mention internal tools, agents, or APIs
- Base everything strictly on the findings provided`;

export function buildVisitorAuditUserPrompt(params: {
  businessName: string;
  websiteUrl: string;
  executiveSummary?: string;
  recommendations?: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
}): string {
  const { businessName, websiteUrl, executiveSummary, recommendations, findings } = params;

  const findingsBlock =
    findings.length > 0
      ? findings
          .map((f) => `[${f.severity}] ${f.title}: ${f.description}`)
          .join('\n')
      : 'No detailed findings recorded.';

  return `Business: ${businessName}
Website: ${websiteUrl}

Executive summary from research:
${executiveSummary ?? 'Not available.'}

Recommendations:
${recommendations ?? 'Not available.'}

Key findings:
${findingsBlock}

Write a visitor-friendly audit report summary.`;
}
