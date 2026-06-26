// Self-improvement loop: turn audit-quality eval signals into a proposed system
// prompt revision. Pure analysis + one LLM "prompt engineer" call — it never
// mutates prompts itself; opening a PR is a separate, human-reviewed step.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { runLlmObject } from '@/lib/llm/generate';
import { computeResearchEvalScores, type EvalScore } from '@/lib/langfuse/research-eval';
import { getAuditById, listRecentAudits } from '@/lib/research/persist';
import type { ImprovablePrompt } from '@/lib/prompts/registry';

const GATE_NAMES = [
  'gate_empty_audit',
  'gate_low_coverage',
  'gate_unsupported_critical',
  'gate_high_tool_error_rate',
] as const;

const AVG_KEYS = [
  'category_coverage_pct',
  'findings_with_evidence_pct',
  'duplicate_finding_ratio',
  'finding_count',
  'tool_error_rate',
] as const;

export interface WeakAuditSample {
  auditId: string;
  businessName: string;
  targetUrl: string;
  keyword: string;
  failedGates: string[];
  findingCount: number;
  categoryCoverage: number;
  summary: string | null;
  sampleFindings: Array<{ severity: string; category: string; title: string; description: string }>;
}

export interface AuditEvidence {
  auditsAnalyzed: number;
  gateFailureRates: Record<string, number>;
  avgScores: Record<string, number>;
  weakSamples: WeakAuditSample[];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function scoreMap(scores: EvalScore[]): Record<string, number> {
  return Object.fromEntries(scores.map((s) => [s.name, s.value]));
}

/**
 * Recompute deterministic eval scores over recent completed audits (zero LLM
 * cost) and surface aggregate weaknesses plus the worst concrete samples.
 */
export async function gatherAuditEvidence(
  supabase: SupabaseClient,
  opts: { limit?: number; maxSamples?: number } = {}
): Promise<AuditEvidence> {
  const { limit = 25, maxSamples = 6 } = opts;

  const recent = await listRecentAudits(supabase, limit);
  const completed = recent.filter((a) => a.status === 'completed');
  const details = (await Promise.all(completed.map((a) => getAuditById(supabase, a.id)))).filter(
    (d): d is NonNullable<typeof d> => d !== null
  );

  const evaluated = details.map((d) => {
    const map = scoreMap(
      computeResearchEvalScores({
        findings: d.findings,
        summary: d.summary,
        recommendations: d.recommendations,
        toolTrace: d.tool_trace ?? [],
      })
    );
    const failedGates = GATE_NAMES.filter((g) => map[g] === 1);
    // Weakness ranking: gate failures dominate, then thin coverage / weak evidence / dupes.
    const weakness =
      failedGates.length * 10 +
      (1 - (map.category_coverage_pct ?? 0)) * 3 +
      (1 - (map.findings_with_evidence_pct ?? 1)) * 2 +
      (map.duplicate_finding_ratio ?? 0) * 2;
    return { d, map, failedGates, weakness };
  });

  const auditsAnalyzed = evaluated.length;

  const gateFailureRates: Record<string, number> = {};
  for (const g of GATE_NAMES) {
    const fails = evaluated.filter((e) => e.map[g] === 1).length;
    gateFailureRates[g] = auditsAnalyzed ? round(fails / auditsAnalyzed) : 0;
  }

  const avgScores: Record<string, number> = {};
  for (const k of AVG_KEYS) {
    const vals = evaluated.map((e) => e.map[k]).filter((v): v is number => typeof v === 'number');
    avgScores[k] = vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }

  const weakSamples: WeakAuditSample[] = evaluated
    .filter((e) => e.weakness > 0)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, maxSamples)
    .map((e) => ({
      auditId: e.d.id,
      businessName: e.d.business_name,
      targetUrl: e.d.target_url,
      keyword: e.d.keyword,
      failedGates: e.failedGates,
      findingCount: e.d.findings.length,
      categoryCoverage: e.map.category_coverage ?? 0,
      summary: e.d.summary,
      sampleFindings: e.d.findings.slice(0, 5).map((f) => ({
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
      })),
    }));

  return { auditsAnalyzed, gateFailureRates, avgScores, weakSamples };
}

export interface PromptRevision {
  shouldRevise: boolean;
  revisedPrompt: string;
  changeSummary: string;
  rationale: string;
  confidence: number;
}

const revisionSchema = z.object({
  shouldRevise: z
    .boolean()
    .describe('false if the evidence does not justify a change or the current prompt is already adequate'),
  revisedPrompt: z
    .string()
    .describe('the full replacement system prompt text; equal to the original when shouldRevise is false'),
  changeSummary: z.string().describe('one-line summary of what changed'),
  rationale: z.string().describe('which eval weaknesses this targets and why the change should help'),
  confidence: z.number().min(0).max(1),
});

const OPTIMIZER_SYSTEM = `You are a senior prompt engineer improving the system prompt of an automated SEO/CRO audit pipeline.

You are given: the current system prompt, the role it plays, hard invariants it must preserve, and concrete quality evidence (aggregate eval gate-failure rates + the weakest recent audits the prompt produced).

Your job: propose a minimally-invasive revision that addresses the observed weaknesses.

Strict rules:
- PRESERVE every listed invariant exactly. If a change would violate an invariant, do not make it.
- Edit conservatively: keep the structure and voice; change only what the evidence justifies. Prefer adding/sharpening a guideline over rewriting wholesale.
- Target the actual failure modes in the evidence (e.g. low category coverage → push the agent to cover more categories; unsupported criticals → demand evidence before labelling something critical; duplicate findings → require de-duplication).
- Do NOT use backticks or the sequence \${ anywhere in the revised prompt.
- If the evidence is weak, sparse, or the prompt is already adequate, set shouldRevise=false and return the original prompt unchanged.
- Return ONLY the structured object.`;

function buildOptimizerPrompt(prompt: ImprovablePrompt, evidence: AuditEvidence): string {
  const gates = Object.entries(evidence.gateFailureRates)
    .map(([k, v]) => `  - ${k}: ${(v * 100).toFixed(0)}% of audits`)
    .join('\n');
  const avgs = Object.entries(evidence.avgScores)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');
  const samples = evidence.weakSamples
    .map((s, i) => {
      const findings = s.sampleFindings
        .map((f) => `      [${f.severity}/${f.category}] ${f.title}: ${f.description}`)
        .join('\n');
      return `  ${i + 1}. ${s.businessName} (${s.keyword}) — ${s.findingCount} findings, ${s.categoryCoverage}/6 categories${
        s.failedGates.length ? `, failed gates: ${s.failedGates.join(', ')}` : ''
      }\n     summary: ${s.summary ?? '(none)'}\n     findings:\n${findings || '      (none)'}`;
    })
    .join('\n\n');

  return `PROMPT ROLE: ${prompt.role}

INVARIANTS (must preserve):
${prompt.invariants.map((inv) => `  - ${inv}`).join('\n')}

CURRENT SYSTEM PROMPT:
"""
${prompt.currentText}
"""

EVIDENCE FROM ${evidence.auditsAnalyzed} RECENT AUDITS:
Gate failure rates (higher = worse):
${gates || '  (none)'}

Average scores:
${avgs || '  (none)'}

Weakest audit samples:
${samples || '  (none)'}

Propose a revision (or shouldRevise=false if not justified).`;
}

/** One LLM critique-and-revise pass. Returns a proposal; never mutates anything. */
export async function proposePromptRevision(params: {
  prompt: ImprovablePrompt;
  evidence: AuditEvidence;
}): Promise<PromptRevision> {
  const { prompt, evidence } = params;

  if (evidence.auditsAnalyzed === 0) {
    return {
      shouldRevise: false,
      revisedPrompt: prompt.currentText,
      changeSummary: 'No completed audits to learn from yet.',
      rationale: 'Insufficient evidence.',
      confidence: 0,
    };
  }

  const result = await runLlmObject({
    schema: revisionSchema,
    system: OPTIMIZER_SYSTEM,
    prompt: buildOptimizerPrompt(prompt, evidence),
    telemetry: { functionId: 'prompt-self-improve' },
  });

  return result;
}
