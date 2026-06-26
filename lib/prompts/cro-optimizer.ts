// Controls the CRO optimizer agent prompt for /api/optimize.
// Runs when the autonomous landing-page optimization endpoint is triggered.

/** System rules for runLlmObject — keep in sync with buildCroOptimizerPrompt. */
export const CRO_OPTIMIZER_SYSTEM_PROMPT = `You are SynapseCRO's autonomous CRO agent. You rewrite landing-page hero copy to raise CTA click rate for local service businesses.

Output contract (strict):
- Return thought_process, action_taken, and updates.
- updates keys MUST be exactly: hero_title, hero_subtitle, cta_text — each with the full new string.
- When conversion rate is below 10%, you MUST change at least two of the three fields to new text (not identical to current copy).
- Never return an empty updates object. Never omit a key.

When "Historical SEO insight memory" is present in the user prompt:
- Reference at least one persistent or recurring issue in thought_process.
- Translate SEO defects into copy fixes (examples):
  - Missing meta / thin page → subtitle states the concrete service + location + outcome in one sentence.
  - Slow LCP / technical → shorter title (≤10 words), fewer filler words, clearer primary benefit.
  - Missing LocalBusiness / trust gaps → subtitle adds credibility (years serving area, reviews, specialist) without inventing facts.
  - Recurring CRO/messaging issues → align H1, subtitle, and CTA to one consistent offer.

Copy rules:
- Plain English, business casual — not marketing jargon.
- hero_title: max 12 words; direct benefit (visibility, enquiries, customers).
- hero_subtitle: one sentence (~25 words max); SEO + landing page + enquiries.
- cta_text: 2–4 words (e.g. "Get a free audit").
- Banned: autonomous, agent, synergy, leverage, ecosystem, cutting-edge, revolutionary, seamless, holistic, empower, unlock, transform, tailored packages.`;

export function buildCroOptimizerPrompt(params: {
  viewCount: number;
  clickCount: number;
  conversionRate: string;
  currentCopy: unknown;
  seoContext?: string;
}): string {
  const { viewCount, clickCount, conversionRate, currentCopy } = params;
  const rateNum = Number.parseFloat(conversionRate);
  const belowTarget = Number.isFinite(rateNum) && rateNum < 10;

  const copyById =
    currentCopy && typeof currentCopy === 'object' && !Array.isArray(currentCopy)
      ? (currentCopy as Record<string, { id?: string; text_content?: string } | string>)
      : {};

  const heroTitle =
    typeof copyById.hero_title === 'string'
      ? copyById.hero_title
      : copyById.hero_title?.text_content ?? '';
  const heroSubtitle =
    typeof copyById.hero_subtitle === 'string'
      ? copyById.hero_subtitle
      : copyById.hero_subtitle?.text_content ?? '';
  const ctaText =
    typeof copyById.cta_text === 'string'
      ? copyById.cta_text
      : copyById.cta_text?.text_content ?? '';

  const seoBlock = params.seoContext?.trim()
    ? `
Historical SEO insight memory (ClickHouse — prioritize issues that persisted across re-audits):
${params.seoContext.trim()}

Use this memory: tie copy changes to unresolved critical/warning items above. Say which issue you addressed in thought_process.
`
    : '';

  const taskBlock = belowTarget
    ? `Conversion is ${conversionRate}% (below 10% target). Rewrite copy to improve CTA clicks. Change at least TWO fields to new text.`
    : `Conversion is ${conversionRate}% (at or above 10%). Make only small clarity tweaks if needed; still return all three keys in updates.`;

  return `Landing page CRO task for a local business site.

Sensory metrics (ClickHouse conversion funnel, last 30 days):
- Page views: ${viewCount}
- CTA clicks: ${clickCount}
- Conversion rate: ${conversionRate}%
${seoBlock}
Current copy (do not repeat verbatim unless unchanged on purpose):
- hero_title: ${JSON.stringify(heroTitle)}
- hero_subtitle: ${JSON.stringify(heroSubtitle)}
- cta_text: ${JSON.stringify(ctaText)}

Raw site_copy rows (for reference):
${JSON.stringify(currentCopy)}

Task:
${taskBlock}

Return updates with keys hero_title, hero_subtitle, cta_text only. Each value must be the complete new string for that field.`;
}
