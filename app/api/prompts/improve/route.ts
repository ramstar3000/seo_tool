import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth/cron-auth';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getAppGitHubRepo } from '@/lib/env';
import { isGitHubConfigured } from '@/lib/github/client';
import { gatherAuditEvidence, proposePromptRevision } from '@/lib/prompts/improve';
import { openPromptImprovementPr } from '@/lib/prompts/improve-pr';
import { IMPROVABLE_PROMPTS, getImprovablePrompt } from '@/lib/prompts/registry';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Prompt self-improvement loop: read recent audit eval signals → have an LLM
// propose a system-prompt revision → open a PR on this app's own repo for human
// review. Never edits prompts in place; a human merges the PR.
//
// Auth: cron (Bearer CRON_SECRET / x-vercel-cron) or an admin user.
// Query params:
//   promptId   — restrict to one registry prompt (default: all)
//   minConfidence — skip proposals below this (default 0.6)
//   dryRun     — "true" to compute proposals without opening PRs
//   limit      — how many recent audits to analyze (default 25)

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const promptId = params.get('promptId') ?? undefined;
  const minConfidence = Number(params.get('minConfidence') ?? '0.6');
  const dryRun = params.get('dryRun') === 'true';
  const limit = Number(params.get('limit') ?? '25');

  const targets = promptId
    ? [getImprovablePrompt(promptId)].filter((p) => p !== undefined)
    : IMPROVABLE_PROMPTS;

  if (targets.length === 0) {
    return NextResponse.json({ error: `Unknown promptId: ${promptId}` }, { status: 400 });
  }

  const repo = getAppGitHubRepo();
  const canOpenPr = !dryRun && Boolean(repo) && isGitHubConfigured();

  try {
    const evidence = await gatherAuditEvidence(supabase, { limit });

    const results = [];
    for (const prompt of targets) {
      const revision = await proposePromptRevision({ prompt, evidence });

      const meaningful =
        revision.shouldRevise &&
        revision.confidence >= minConfidence &&
        revision.revisedPrompt.trim() !== prompt.currentText.trim();

      let pr: { prUrl: string; prNumber: number; branchName: string } | null = null;
      let prSkippedReason: string | null = null;

      if (!meaningful) {
        prSkippedReason = !revision.shouldRevise
          ? 'model judged no change needed'
          : revision.confidence < minConfidence
            ? `confidence ${revision.confidence} < ${minConfidence}`
            : 'revision identical to current';
      } else if (!canOpenPr) {
        prSkippedReason = dryRun
          ? 'dryRun'
          : !repo
            ? 'APP_GITHUB_REPO not set'
            : 'GitHub token not configured';
      } else {
        try {
          pr = await openPromptImprovementPr({ repo: repo as string, prompt, revision, evidence });
        } catch (err) {
          prSkippedReason = err instanceof Error ? err.message : 'PR creation failed';
        }
      }

      results.push({
        promptId: prompt.id,
        label: prompt.label,
        shouldRevise: revision.shouldRevise,
        confidence: revision.confidence,
        changeSummary: revision.changeSummary,
        rationale: revision.rationale,
        prUrl: pr?.prUrl ?? null,
        prSkippedReason,
        // include the proposed text only in dry runs to keep cron responses small
        ...(dryRun ? { revisedPrompt: revision.revisedPrompt } : {}),
      });
    }

    return NextResponse.json({
      success: true,
      auditsAnalyzed: evidence.auditsAnalyzed,
      gateFailureRates: evidence.gateFailureRates,
      avgScores: evidence.avgScores,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prompt improvement failed';
    const status = message.includes('not configured') ? 503 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
