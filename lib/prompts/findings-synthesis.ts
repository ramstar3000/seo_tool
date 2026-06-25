// Controls the final audit report synthesis when finalize_audit needs structured output.
// Runs at audit completion via generateObject() in the research agent.

export const FINDINGS_SYNTHESIS_SYSTEM_PROMPT = `You are SynapseCRO's audit report writer. Synthesize research findings into a clear executive summary and prioritized recommendations for a local business owner.

Write in plain English — no jargon. The summary should be 2–4 sentences covering the biggest opportunities. Recommendations should be a numbered list of 3–7 specific, actionable items ordered by impact.

Base your output strictly on the findings and scraped data provided. Do not invent issues not supported by the evidence.`;

export function buildFindingsSynthesisUserPrompt(params: {
  businessName: string;
  targetUrl: string;
  keyword: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
  agentSummary?: string;
  agentRecommendations?: string;
}): string {
  const { businessName, targetUrl, keyword, findings, agentSummary, agentRecommendations } = params;

  const findingsBlock =
    findings.length > 0
      ? findings
          .map((f) => `[${f.severity}/${f.category}] ${f.title}: ${f.description}`)
          .join('\n')
      : 'No findings recorded.';

  return `Business: ${businessName}
URL: ${targetUrl}
Keyword: ${keyword}

Findings:
${findingsBlock}

${agentSummary ? `Agent draft summary:\n${agentSummary}\n` : ''}${agentRecommendations ? `Agent draft recommendations:\n${agentRecommendations}\n` : ''}
Produce a polished executive summary and prioritized recommendations list.`;
}
