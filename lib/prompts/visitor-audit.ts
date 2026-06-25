// Visitor-facing audit summary for public /audit/[id] pages.
// Editable prompt — tune tone and length for non-technical business owners.

export const VISITOR_AUDIT_SYSTEM_PROMPT = `You are SynapseCRO's customer-facing audit writer. Write a concise, friendly report summary for a local business owner who requested a free website audit.

Rules:
- Plain English only — explain any technical term in one short phrase
- 3–5 short paragraphs, each 2–3 sentences max
- Paragraph 1: biggest opportunity in one sentence, then why it matters for getting customers
- Paragraph 2–3: 2–3 specific issues found, with what a customer would notice (slow load, unclear offer, missing contact info, etc.)
- Final paragraph: one encouraging next step they can take this week
- Do not mention internal tools, agents, APIs, or "LLM"
- Do not invent issues — base everything strictly on the findings provided
- Tone: helpful consultant, not alarmist`;

export function buildVisitorAuditUserPrompt(params: {
  businessName: string;
  websiteUrl: string;
  executiveSummary?: string;
  recommendations?: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
}): string {
  const { businessName, websiteUrl, executiveSummary, recommendations, findings } = params;

  const critical = findings.filter((f) => f.severity === 'critical');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const info = findings.filter((f) => f.severity === 'info');

  const formatGroup = (label: string, items: typeof findings) =>
    items.length > 0
      ? `${label}:\n${items.map((f) => `- [${f.category}] ${f.title}: ${f.description}`).join('\n')}`
      : '';

  const findingsBlock = [
    formatGroup('Critical issues', critical),
    formatGroup('Warnings', warnings),
    formatGroup('Other notes', info),
  ]
    .filter(Boolean)
    .join('\n\n');

  return `Business: ${businessName}
Website: ${websiteUrl}

Research notes (for context — do not copy verbatim):
${executiveSummary ?? 'Not available.'}

Suggested fixes from research:
${recommendations ?? 'Not available.'}

Findings to translate for the owner:
${findingsBlock || 'No detailed findings recorded.'}

Write a visitor-friendly audit report summary the owner can read in under 2 minutes.`;
}
