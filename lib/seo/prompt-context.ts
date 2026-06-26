import { getSeoPromptContext } from '@/lib/clickhouse/seo-insights';

/** Returns a formatted SEO memory block for LLM prompts, or null when ClickHouse has no data. */
export async function fetchSeoPromptContext(params: {
  leadId?: string;
  auditId?: string;
  keyword?: string;
  days?: number;
}): Promise<string | null> {
  const context = await getSeoPromptContext(params);
  if (context.source !== 'clickhouse') return null;
  if (context.auditCount === 0 && context.findingCount === 0) return null;
  return context.promptBlock;
}

export async function fetchSeoPromptContextForLead(
  leadId: string,
  days = 90
): Promise<string | null> {
  return fetchSeoPromptContext({ leadId, days });
}
