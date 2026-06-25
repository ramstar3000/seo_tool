export type FindingAction = 'automated' | 'semi_auto' | 'manual';

export interface ActionableFinding {
  severity: string;
  category: string;
  title: string;
  description: string;
}

const AUTOMATED_PATTERNS = [
  /\bmeta\b/i,
  /\btitle\b/i,
  /\bdescription\b/i,
  /\bh1\b/i,
  /\bheading\b/i,
  /\bschema\b/i,
  /\bjson-ld\b/i,
  /\bcanonical\b/i,
  /\bnoindex\b/i,
  /\brobots\b/i,
  /\balt text\b/i,
  /\bcta\b/i,
  /\bcopy\b/i,
  /\bcontent\b/i,
  /\blanding page\b/i,
  /\bseo tag\b/i,
  /\bopen graph\b/i,
  /\bog:/i,
];

const MANUAL_PATTERNS = [
  /\bsocial\b/i,
  /\bgoogle business\b/i,
  /\bgbp\b/i,
  /\bbacklink\b/i,
  /\breview\b/i,
  /\binstagram\b/i,
  /\blinkedin\b/i,
  /\bfacebook\b/i,
  /\btwitter\b/i,
  /\bx\.com\b/i,
  /\bdirectory\b/i,
  /\blisting\b/i,
];

export function classifyFindingAction(finding: ActionableFinding): FindingAction {
  const text = `${finding.category} ${finding.title} ${finding.description}`;

  if (MANUAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'manual';
  }

  if (AUTOMATED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'automated';
  }

  if (finding.category === 'technical' || finding.category === 'on_page') {
    return 'automated';
  }

  if (finding.category === 'social' || finding.category === 'off_page') {
    return 'manual';
  }

  return 'semi_auto';
}

export function groupFindingsByAction(findings: ActionableFinding[]) {
  const automated: ActionableFinding[] = [];
  const semiAuto: ActionableFinding[] = [];
  const manual: ActionableFinding[] = [];

  for (const finding of findings) {
    const action = classifyFindingAction(finding);
    if (action === 'automated') automated.push(finding);
    else if (action === 'manual') manual.push(finding);
    else semiAuto.push(finding);
  }

  return { automated, semiAuto, manual };
}
