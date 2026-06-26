export type ApiProvider =
  | 'gemini'
  | 'anthropic'
  | 'tavily'
  | 'firecrawl'
  | 'resend'
  | 'pagespeed'
  | 'github';

export const API_PROVIDERS: ApiProvider[] = [
  'gemini',
  'anthropic',
  'tavily',
  'firecrawl',
  'resend',
  'pagespeed',
  'github',
];

export interface RecordApiUsageParams {
  provider: ApiProvider;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  estimatedUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderSpendSummary {
  provider: ApiProvider;
  spentUsd: number;
  capUsd: number | null;
  capped: boolean;
  warning: boolean;
  last7DaysUsd: number;
  callCount: number;
}

export interface CostSummary {
  totalSpendUsd: number;
  globalCapUsd: number | null;
  globalCapped: boolean;
  globalWarning: boolean;
  llmSpendUsd: number;
  llmCapUsd: number;
  llmCapped: boolean;
  providers: ProviderSpendSummary[];
  last7DaysUsd: number;
}
