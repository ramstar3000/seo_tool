// Controls the final audit report synthesis when finalize_audit needs structured output.
// Runs at audit completion via generateObject() in the research agent.

import { buildSeoLlmPromptBlock } from '@/lib/prompts/seo-llm-knowledge';

export const FINDINGS_SYNTHESIS_SYSTEM_PROMPT = `You are SynapseCRO's audit report writer. Synthesize research findings into a short executive summary and MUST_DO actions for the site owner (local business, individual creator, or brand — match the site type implied by findings).

Write in plain English — no jargon. The summary should be 2–3 sentences max. Recommendations must be exactly 3 items, each starting with "MUST_DO:" — one line each, highest impact first. No fluff, no generic SEO advice. Do not recommend local-only tactics (GBP, borough pages, NAP) unless findings show a local service business.

Base your output strictly on the findings and scraped data provided. Do not invent issues not supported by the evidence.
${buildSeoLlmPromptBlock('synthesize')}`;

export function buildFindingsSynthesisUserPrompt(params: {
  businessName: string;
  targetUrl: string;
  keyword: string;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
  agentSummary?: string;
  agentRecommendations?: string;
  priorInsights?: string | null;
}): string {
  const { businessName, targetUrl, keyword, findings, agentSummary, agentRecommendations, priorInsights } =
    params;

  const findingsBlock =
    findings.length > 0
      ? findings
          .map((f) => `[${f.severity}/${f.category}] ${f.title}: ${f.description}`)
          .join('\n')
      : 'No findings recorded.';

  const memoryBlock = priorInsights
    ? `Prior audit history (prioritize issues that have persisted across audits):\n${priorInsights}\n\n`
    : '';

  return `Business: ${businessName}
URL: ${targetUrl}
Keyword: ${keyword}

${memoryBlock}Findings:
${findingsBlock}

${agentSummary ? `Agent draft summary:\n${agentSummary}\n` : ''}${agentRecommendations ? `Agent draft recommendations:\n${agentRecommendations}\n` : ''}
Produce a short executive summary and exactly 3 MUST_DO recommendations (one line each).`;
}
