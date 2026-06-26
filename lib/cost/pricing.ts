import type { ApiProvider } from '@/lib/cost/types';

/** Published Gemini Flash rates (USD per 1M tokens), rounded up for safety. */
const GEMINI_FLASH_INPUT_USD_PER_M = 0.15;
const GEMINI_FLASH_OUTPUT_USD_PER_M = 0.6;

/** Conservative Anthropic Haiku rates (USD per 1M tokens). */
const ANTHROPIC_HAIKU_INPUT_USD_PER_M = 1;
const ANTHROPIC_HAIKU_OUTPUT_USD_PER_M = 5;

/** Tavily basic search — ~1 credit per query on pay-as-you-go. */
const TAVILY_SEARCH_USD = 0.01;

/** Firecrawl scrape — ~1 credit per page on hobby tier. */
const FIRECRAWL_SCRAPE_USD = 0.002;

/** Resend — conservative per-email estimate beyond free tier. */
const RESEND_EMAIL_USD = 0.001;

export function estimateLlmUsageUsd(params: {
  provider: 'gemini' | 'anthropic';
  inputTokens: number;
  outputTokens: number;
}): number {
  const inputRate =
    params.provider === 'anthropic' ? ANTHROPIC_HAIKU_INPUT_USD_PER_M : GEMINI_FLASH_INPUT_USD_PER_M;
  const outputRate =
    params.provider === 'anthropic' ? ANTHROPIC_HAIKU_OUTPUT_USD_PER_M : GEMINI_FLASH_OUTPUT_USD_PER_M;

  return (
    (params.inputTokens / 1_000_000) * inputRate + (params.outputTokens / 1_000_000) * outputRate
  );
}

export function estimateOperationUsd(provider: ApiProvider, operation: string, units = 1): number {
  switch (provider) {
    case 'tavily':
      return operation === 'search' ? TAVILY_SEARCH_USD * units : TAVILY_SEARCH_USD * units;
    case 'firecrawl':
      return FIRECRAWL_SCRAPE_USD * units;
    case 'resend':
      return RESEND_EMAIL_USD * units;
    case 'pagespeed':
    case 'github':
      return 0;
    default:
      return 0;
  }
}
