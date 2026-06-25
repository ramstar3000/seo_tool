export function scoreLead(rankPosition: 3 | 4, hasWebsite: boolean): number {
  let score = rankPosition === 3 ? 85 : 75;
  if (hasWebsite) score += 5;
  return score;
}
