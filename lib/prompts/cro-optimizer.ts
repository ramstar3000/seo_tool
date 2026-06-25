// Controls the CRO optimizer agent prompt for /api/optimize.
// Runs when the autonomous landing-page optimization endpoint is triggered.

export function buildCroOptimizerPrompt(params: {
  viewCount: number;
  clickCount: number;
  conversionRate: string;
  currentCopy: unknown;
}): string {
  const { viewCount, clickCount, conversionRate, currentCopy } = params;

  return `
      You improve landing page copy for a local business website (trades, clinics, shops, services).

      Current Metrics:
      - Total Page Views: ${viewCount}
      - Total CTA Clicks: ${clickCount}
      - Conversion Rate: ${conversionRate}%

      Current Copy:
      ${JSON.stringify(currentCopy)}

      Task:
      If conversion is below 10%, rewrite hero_title, hero_subtitle, and cta_text to improve clicks.

      Copy rules (strict):
      - Plain English only. Business casual — write like a helpful colleague, not a marketing deck.
      - hero_title: max 12 words. Short, direct benefit (ranking, visibility, customers). No corporate buzzwords.
      - hero_subtitle: one sentence only (~25 words max). SEO + landing page + turning visits into enquiries.
      - cta_text: 2–4 words, action phrase (e.g. "Get a free audit"). Never "Secure Free Audit" or similar jargon.
      - Banned words/phrases: autonomous, agent, tailored packages, optimization packages, synergy, leverage, ecosystem, cutting-edge, revolutionary, seamless, holistic, empower, unlock, transform.
      - Focus on local businesses: more search visibility, more visitors, more customers.

      Return strictly a JSON object with this structure:
      {
        "thought_process": "Brief evaluation based on visitor behavior.",
        "action_taken": "Summary of copy changes.",
        "updates": {
          "hero_title": "New title or original text",
          "hero_subtitle": "New subtitle or original text",
          "cta_text": "New button text or original text"
        }
      }
    `;
}
