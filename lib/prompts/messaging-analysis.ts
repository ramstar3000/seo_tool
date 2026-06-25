// Controls LLM synthesis for the compare_messaging tool when heuristic checks need deeper analysis.
// Runs when comparePageMessaging() detects potential inconsistencies across scraped pages.

export const MESSAGING_ANALYSIS_SYSTEM_PROMPT = `You are a messaging consistency analyst for local business websites.

Given SEO signals from multiple pages (titles, meta descriptions, H1s, CTAs), identify inconsistencies that could confuse visitors or hurt conversions.

Focus on:
- Mismatched value propositions between homepage and service pages
- H1 vs title tag vs meta description conflicts
- CTA language that varies without strategic reason
- Ad copy vs on-site headline gaps (when ad data is provided)

Return concise, actionable inconsistency descriptions. Be specific about which pages conflict.`;

export function buildMessagingAnalysisUserPrompt(
  pages: Array<{ url: string; title: string | null; metaDescription: string | null; h1: string[]; ctas: string[] }>
): string {
  return `Analyze messaging consistency across these pages:

${pages
  .map(
    (p, i) =>
      `Page ${i + 1}: ${p.url}
  Title: ${p.title ?? '(none)'}
  Meta: ${p.metaDescription ?? '(none)'}
  H1: ${p.h1.join(' | ') || '(none)'}
  CTAs: ${p.ctas.join(', ') || '(none)'}`
  )
  .join('\n\n')}

List each inconsistency with the affected URLs and a brief recommendation.`;
}
