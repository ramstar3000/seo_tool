import type { LanguageModelUsage } from 'ai';
import { ApiSpendCapExceededError, assertWithinBudget } from '@/lib/cost/check';
import { getLlmSpendCapUsd } from '@/lib/cost/limits';
import { estimateLlmUsageUsd } from '@/lib/cost/pricing';
import { getLlmSpendUsd, recordApiUsage } from '@/lib/cost/tracker';
import { getActiveLlmProvider, getActiveModelId } from '@/lib/llm/client';

/** @deprecated Use ApiSpendCapExceededError from lib/cost/check */
export class LlmSpendCapExceededError extends ApiSpendCapExceededError {
  constructor(spentUsd: number, capUsd: number) {
    super('gemini', spentUsd, capUsd);
    this.name = 'LlmSpendCapExceededError';
  }
}

export function estimateUsageUsd(params: {
  provider: 'gemini' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  return estimateLlmUsageUsd({
    provider: params.provider,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
  });
}

export async function getTotalLlmSpendUsd(): Promise<number> {
  return getLlmSpendUsd();
}

export async function assertLlmSpendCapNotExceeded(): Promise<void> {
  const provider = getActiveLlmProvider();
  if (!provider) return;
  try {
    await assertWithinBudget(provider);
  } catch (error) {
    if (error instanceof ApiSpendCapExceededError) {
      throw new LlmSpendCapExceededError(error.spentUsd, error.capUsd);
    }
    throw error;
  }
}

export async function recordLlmUsage(usage: LanguageModelUsage): Promise<void> {
  const provider = getActiveLlmProvider();
  if (!provider) return;

  const model = getActiveModelId();
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  await recordApiUsage({
    provider,
    operation: 'generate',
    inputTokens,
    outputTokens,
    metadata: { model },
  });
}

export async function getLlmSpendSummary(): Promise<{ spentUsd: number; capUsd: number }> {
  const capUsd = getLlmSpendCapUsd();
  const spentUsd = await getLlmSpendUsd();
  return { spentUsd, capUsd };
}
