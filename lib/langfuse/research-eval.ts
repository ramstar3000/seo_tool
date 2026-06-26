import { z } from 'zod';
import { propagateAttributes } from '@langfuse/tracing';
import { isResearchLlmConfigured } from '@/lib/llm/client';
import { runLlmObject } from '@/lib/llm/generate';
import type { AuditFinding, FindingCategory, ToolTraceEntry } from '@/lib/research/types';

export interface EvalScore {
  name: string;
  value: number;
  comment?: string;
}

export interface ResearchEvalInput {
  findings: AuditFinding[];
  summary: string | null;
  recommendations: string | null;
  toolTrace: ToolTraceEntry[];
  rankPosition?: number | null;
  lcpMs?: number | null;
  competitorCount?: number | null;
}

const ALL_CATEGORIES: FindingCategory[] = [
  'seo',
  'messaging',
  'cro',
  'technical',
  'competitive',
  'social',
];

function hasEvidence(f: AuditFinding): boolean {
  return Boolean(f.evidence && Object.keys(f.evidence).length > 0);
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Deterministic, zero-cost quality signals derived from the audit output and the
 * agent's tool trace. These rate coverage, evidence-grounding, agent behaviour, and
 * outcome metrics — no LLM call required.
 */
export function computeResearchEvalScores(input: ResearchEvalInput): EvalScore[] {
  const { findings, summary, recommendations, toolTrace } = input;
  const total = findings.length;

  const bySeverity = findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  const categories = new Set(findings.map((f) => f.category));
  const withEvidence = findings.filter(hasEvidence).length;
  const criticals = findings.filter((f) => f.severity === 'critical');
  const criticalsWithEvidence = criticals.filter(hasEvidence).length;
  const unsupportedCriticals = criticals.length - criticalsWithEvidence;

  const titles = findings.map((f) => f.title.trim().toLowerCase());
  const duplicateTitles = titles.length - new Set(titles).size;
  const avgDescriptionChars = total
    ? Math.round(findings.reduce((sum, f) => sum + f.description.length, 0) / total)
    : 0;

  const toolCalls = toolTrace.length;
  const toolErrors = toolTrace.filter((t) => Boolean(t.error)).length;
  const distinctTools = new Set(toolTrace.map((t) => t.toolName)).size;
  const pagesScraped = toolTrace.filter((t) => t.toolName === 'scrape_page_seo').length;
  const agentTurns = toolTrace.reduce((max, t) => Math.max(max, t.turn), 0);
  const toolErrorRate = toolCalls ? toolErrors / toolCalls : 0;

  const scores: EvalScore[] = [
    // --- coverage ---
    { name: 'finding_count', value: total },
    { name: 'critical_count', value: bySeverity.critical },
    { name: 'warning_count', value: bySeverity.warning },
    { name: 'info_count', value: bySeverity.info },
    {
      name: 'severity_weighted_load',
      value: bySeverity.critical * 3 + bySeverity.warning,
      comment: 'critical×3 + warning×1 — overall issue burden surfaced',
    },
    { name: 'category_coverage', value: categories.size, comment: `of ${ALL_CATEGORIES.length} categories` },
    { name: 'category_coverage_pct', value: round(categories.size / ALL_CATEGORIES.length) },

    // --- evidence / specificity quality ---
    {
      name: 'findings_with_evidence_pct',
      value: total ? round(withEvidence / total) : 0,
      comment: `${withEvidence}/${total} findings carry structured evidence`,
    },
    {
      name: 'critical_evidence_pct',
      value: criticals.length ? round(criticalsWithEvidence / criticals.length) : 1,
      comment: `${criticalsWithEvidence}/${criticals.length} critical findings backed by evidence`,
    },
    { name: 'avg_description_chars', value: avgDescriptionChars },
    {
      name: 'duplicate_finding_ratio',
      value: total ? round(duplicateTitles / total) : 0,
      comment: 'lower is better — fraction of repeated finding titles',
    },

    // --- report completeness ---
    { name: 'has_summary', value: summary && summary.trim().length > 0 ? 1 : 0 },
    { name: 'has_recommendations', value: recommendations && recommendations.trim().length > 0 ? 1 : 0 },
    { name: 'summary_chars', value: summary?.length ?? 0 },
    { name: 'recommendations_chars', value: recommendations?.length ?? 0 },

    // --- agent behaviour (from tool trace) ---
    { name: 'tool_call_count', value: toolCalls },
    { name: 'tool_error_count', value: toolErrors },
    { name: 'tool_error_rate', value: round(toolErrorRate) },
    { name: 'distinct_tools_used', value: distinctTools },
    { name: 'pages_scraped', value: pagesScraped },
    { name: 'agent_turns', value: agentTurns },

    // --- automated quality gates (1 = needs attention) ---
    { name: 'gate_empty_audit', value: total === 0 ? 1 : 0 },
    { name: 'gate_low_coverage', value: categories.size < 3 ? 1 : 0, comment: '<3 categories covered' },
    {
      name: 'gate_unsupported_critical',
      value: unsupportedCriticals > 0 ? 1 : 0,
      comment: `${unsupportedCriticals} critical finding(s) lack evidence`,
    },
    { name: 'gate_high_tool_error_rate', value: toolErrorRate > 0.2 ? 1 : 0, comment: '>20% tool calls errored' },
  ];

  // outcome metrics are only meaningful when present
  if (input.rankPosition != null) scores.push({ name: 'rank_position', value: input.rankPosition });
  if (input.lcpMs != null) scores.push({ name: 'lcp_ms', value: input.lcpMs });
  if (input.competitorCount != null) scores.push({ name: 'competitor_count', value: input.competitorCount });

  return scores;
}

const judgeSchema = z.object({
  actionability: z.number().int().min(1).max(5),
  specificity: z.number().int().min(1).max(5),
  severity_calibration: z.number().int().min(1).max(5),
  evidence_grounding: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
  rationale: z.string().max(600),
});

const JUDGE_SYSTEM = `You are a strict QA reviewer for an automated SEO/CRO research agent.
Rate the audit it produced on a 1-5 scale (1 = poor, 5 = excellent) across:
- actionability: can a site owner act on the findings without further clarification?
- specificity: are findings concrete (cite pages, elements, copy) rather than generic?
- severity_calibration: are critical/warning/info labels justified by real impact?
- evidence_grounding: are claims backed by the cited evidence, with no hallucinated facts?
- overall: holistic quality.
Be skeptical. Generic, unverifiable, or mislabelled findings should score low.
Return ONLY the structured object.`;

function buildJudgePrompt(input: ResearchEvalInput): string {
  const findingLines = input.findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity}/${f.category}] ${f.title}\n   ${f.description}\n   evidence: ${
          f.evidence ? JSON.stringify(f.evidence) : 'none'
        }`
    )
    .join('\n');

  return `AUDIT SUMMARY:\n${input.summary ?? '(none)'}\n\nRECOMMENDATIONS:\n${
    input.recommendations ?? '(none)'
  }\n\nFINDINGS (${input.findings.length}):\n${findingLines || '(no findings)'}`;
}

/** True unless explicitly disabled — the judge adds one LLM call per audit. */
export function isResearchJudgeEnabled(): boolean {
  return isResearchLlmConfigured() && process.env.LANGFUSE_RESEARCH_JUDGE !== 'false';
}

/**
 * LLM-as-a-judge pass. Returns 1-5 quality scores plus a rationale comment, or an
 * empty array when disabled, when there is nothing to judge, or on failure (never throws).
 */
export async function runResearchQualityJudge(
  input: ResearchEvalInput,
  sessionId?: string
): Promise<EvalScore[]> {
  if (!isResearchJudgeEnabled() || input.findings.length === 0) return [];

  try {
    const verdict = await propagateAttributes(
      {
        traceName: 'synapsecro.research_audit.judge',
        tags: ['research', 'audit', 'eval', 'judge'],
        ...(sessionId ? { sessionId } : {}),
      },
      () =>
        runLlmObject({
          schema: judgeSchema,
          system: JUDGE_SYSTEM,
          prompt: buildJudgePrompt(input),
          telemetry: { functionId: 'research-eval-judge' },
        })
    );

    return [
      { name: 'judge_actionability', value: verdict.actionability, comment: verdict.rationale },
      { name: 'judge_specificity', value: verdict.specificity },
      { name: 'judge_severity_calibration', value: verdict.severity_calibration },
      { name: 'judge_evidence_grounding', value: verdict.evidence_grounding },
      { name: 'judge_overall', value: verdict.overall, comment: verdict.rationale },
    ];
  } catch (error) {
    console.error('[langfuse] research quality judge failed:', error);
    return [];
  }
}
