import type { ApiProvider } from '@/lib/cost/types';

function parseCapEnv(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** All-time LLM spend cap (Gemini + Anthropic combined). Default $30. */
export function getLlmSpendCapUsd(): number {
  const raw = process.env.GEMINI_SPEND_CAP_USD;
  if (raw === undefined || raw.trim() === '') return 30;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function getGlobalSpendCapUsd(): number | null {
  return parseCapEnv('GLOBAL_SPEND_CAP_USD');
}

export function getProviderSpendCapUsd(provider: ApiProvider): number | null {
  switch (provider) {
    case 'gemini':
    case 'anthropic':
      return getLlmSpendCapUsd();
    case 'tavily':
      return parseCapEnv('TAVILY_SPEND_CAP_USD');
    case 'firecrawl':
      return parseCapEnv('FIRECRAWL_SPEND_CAP_USD');
    case 'resend':
      return parseCapEnv('RESEND_SPEND_CAP_USD');
    case 'pagespeed':
      return parseCapEnv('PAGESPEED_SPEND_CAP_USD');
    case 'github':
      return parseCapEnv('GITHUB_CALL_CAP');
    default:
      return null;
  }
}

/** Warning threshold — 80% of cap. */
export function isNearCap(spentUsd: number, capUsd: number | null): boolean {
  if (capUsd === null || capUsd <= 0) return false;
  return spentUsd >= capUsd * 0.8;
}
