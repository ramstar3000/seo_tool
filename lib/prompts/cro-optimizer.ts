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
      You are the autonomous conversion rate optimizer (CRO) agent for our landing page.
      
      Current Metrics:
      - Total Page Views: ${viewCount}
      - Total CTA Clicks: ${clickCount}
      - Conversion Rate: ${conversionRate}%

      Current Layout Copy State:
      ${JSON.stringify(currentCopy)}

      Task:
      Evaluate text efficiency. If conversion is sub-optimal (less than 10%), rewrite 'hero_title' and 'hero_subtitle' to be more punchy, benefit-driven, and clear.
      
      Return strictly a JSON object with this structure:
      {
        "thought_process": "Your concise evaluation analysis based on visitor behavior.",
        "action_taken": "Summary of adjustments made.",
        "updates": {
          "hero_title": "New title value or original text",
          "hero_subtitle": "New subtitle value or original text",
          "cta_text": "New button value or original text"
        }
      }
    `;
}
