/**
 * Stable Langfuse session key shared by the research generation trace and its
 * downstream eval trace. Grouping by leadId (when present) or the normalized
 * target URL puts every run + eval for a site under one Langfuse session, so the
 * agent execution and its quality scores are correlatable without a shared trace id.
 */
export function researchSessionId(params: {
  leadId?: string | null;
  targetUrl?: string | null;
}): string {
  if (params.leadId) return params.leadId;
  if (params.targetUrl) {
    return `url:${params.targetUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()}`;
  }
  return 'research:unknown';
}
