// Registry of system prompts that the self-improvement loop is allowed to revise.
// Each entry maps a prompt to the repo file it lives in and the hard invariants
// the optimizer must preserve (so a revision can't break downstream parsing).
//
// These prompts append a shared SEO knowledge block at runtime via
// ${buildSeoLlmPromptBlock(...)}. We register only the EDITABLE STATIC portion
// (the text before that interpolation), which is a verbatim substring of the
// source file — so it can be located and spliced exactly, and the shared rubric
// is left untouched.

import { RESEARCH_AGENT_SYSTEM_PROMPT } from '@/lib/prompts/research-agent';
import { FINDINGS_SYNTHESIS_SYSTEM_PROMPT } from '@/lib/prompts/findings-synthesis';
import { buildSeoLlmPromptBlock } from '@/lib/prompts/seo-llm-knowledge';

export interface ImprovablePrompt {
  id: string;
  label: string;
  /** Path within the repo where the constant is defined. */
  filePath: string;
  /** The exported constant name (for the PR description). */
  exportName: string;
  /** What this prompt controls — guides the optimizer. */
  role: string;
  /** Hard contracts the revision MUST keep, or downstream code breaks. */
  invariants: string[];
  /** Exact editable static text; must appear verbatim in filePath. */
  currentText: string;
}

/** Strip the runtime-appended `\n${buildSeoLlmPromptBlock(mode)}` block, leaving the editable static text. */
function editableStaticText(full: string, mode: 'audit' | 'edit' | 'synthesize'): string {
  const suffix = `\n${buildSeoLlmPromptBlock(mode)}`;
  return full.endsWith(suffix) ? full.slice(0, -suffix.length) : full;
}

const SHARED_RUBRIC_INVARIANT =
  'A shared SEO knowledge block is appended automatically at runtime — do not reproduce, reference, or include it; revise only the text shown.';

export const IMPROVABLE_PROMPTS: ImprovablePrompt[] = [
  {
    id: 'research-agent-system',
    label: 'Research agent system prompt',
    filePath: 'lib/prompts/research-agent.ts',
    exportName: 'RESEARCH_AGENT_SYSTEM_PROMPT',
    role: 'Drives the autonomous multi-turn site-audit agent: which tools to call, in what order, how to save findings, and when to finalize.',
    invariants: [
      'Must instruct the agent to save findings with save_finding and to call finalize_audit to complete the audit.',
      'Severity values must remain exactly: critical, warning, info.',
      'Category values must remain exactly: seo, messaging, cro, technical, competitive, social.',
      'Must not remove guidance to respect rate limits / avoid unnecessary scraping.',
      'Must retain quality-bar guidance on category coverage, evidence for criticals, de-duplication, and re-verifying persistent issues from ClickHouse memory.',
      SHARED_RUBRIC_INVARIANT,
    ],
    currentText: editableStaticText(RESEARCH_AGENT_SYSTEM_PROMPT, 'audit'),
  },
  {
    id: 'findings-synthesis-system',
    label: 'Findings synthesis system prompt',
    filePath: 'lib/prompts/findings-synthesis.ts',
    exportName: 'FINDINGS_SYNTHESIS_SYSTEM_PROMPT',
    role: 'Synthesizes the final executive summary and the MUST_DO recommendations from collected findings.',
    invariants: [
      'Output must remain an executive summary plus exactly 3 recommendations, each line starting with "MUST_DO:".',
      'Must stay grounded strictly in the provided findings — no invented issues.',
      'Must retain guidance to address persistent/recurring issues from prior audit history when provided.',
      SHARED_RUBRIC_INVARIANT,
    ],
    currentText: editableStaticText(FINDINGS_SYNTHESIS_SYSTEM_PROMPT, 'synthesize'),
  },
];

export function getImprovablePrompt(id: string): ImprovablePrompt | undefined {
  return IMPROVABLE_PROMPTS.find((p) => p.id === id);
}
