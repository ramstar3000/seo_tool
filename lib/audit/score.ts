export interface ScorableFinding {
  severity: string;
}

export function computeAuditScore(findings: ScorableFinding[]): number {
  if (findings.length === 0) return 78;

  let score = 100;
  for (const finding of findings) {
    if (finding.severity === 'critical') score -= 15;
    else if (finding.severity === 'warning') score -= 8;
    else score -= 3;
  }

  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number): { label: string; tone: 'good' | 'fair' | 'poor' } {
  if (score >= 75) return { label: 'Good foundation', tone: 'good' };
  if (score >= 50) return { label: 'Room to improve', tone: 'fair' };
  return { label: 'Needs attention', tone: 'poor' };
}
