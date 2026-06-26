import {
  getGlobalSpendCapUsd,
  getLlmSpendCapUsd,
  getProviderSpendCapUsd,
} from '@/lib/cost/limits';
import { getGlobalSpendUsd, getLlmSpendUsd, getProviderSpendUsd } from '@/lib/cost/tracker';
import type { ApiProvider } from '@/lib/cost/types';

export class ApiSpendCapExceededError extends Error {
  readonly provider: ApiProvider | 'global';
  readonly spentUsd: number;
  readonly capUsd: number;

  constructor(provider: ApiProvider | 'global', spentUsd: number, capUsd: number) {
    const label = provider === 'global' ? 'Global API' : provider;
    super(
      `${label} spend cap reached ($${spentUsd.toFixed(2)} / $${capUsd.toFixed(2)}). Further calls are blocked.`
    );
    this.name = 'ApiSpendCapExceededError';
    this.provider = provider;
    this.spentUsd = spentUsd;
    this.capUsd = capUsd;
  }
}

export type BudgetCheckResult =
  | { allowed: true }
  | { allowed: false; provider: ApiProvider | 'global'; spentUsd: number; capUsd: number };

export async function checkBudget(provider: ApiProvider): Promise<BudgetCheckResult> {
  const globalCap = getGlobalSpendCapUsd();
  if (globalCap !== null) {
    const globalSpent = await getGlobalSpendUsd();
    if (globalSpent >= globalCap) {
      return { allowed: false, provider: 'global', spentUsd: globalSpent, capUsd: globalCap };
    }
  }

  if (provider === 'gemini' || provider === 'anthropic') {
    const llmCap = getLlmSpendCapUsd();
    const llmSpent = await getLlmSpendUsd();
    if (llmSpent >= llmCap) {
      return { allowed: false, provider, spentUsd: llmSpent, capUsd: llmCap };
    }
    return { allowed: true };
  }

  const cap = getProviderSpendCapUsd(provider);
  if (cap === null) return { allowed: true };

  const spent = await getProviderSpendUsd(provider);
  if (spent >= cap) {
    return { allowed: false, provider, spentUsd: spent, capUsd: cap };
  }

  return { allowed: true };
}

export async function assertWithinBudget(provider: ApiProvider): Promise<void> {
  const result = await checkBudget(provider);
  if (!result.allowed) {
    throw new ApiSpendCapExceededError(result.provider, result.spentUsd, result.capUsd);
  }
}

export async function isWithinBudget(provider: ApiProvider): Promise<boolean> {
  const result = await checkBudget(provider);
  return result.allowed;
}
