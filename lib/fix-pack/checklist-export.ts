import type { AuditFixPack } from '@/lib/fix-pack/types';

export function fixPackToChecklistMarkdown(pack: AuditFixPack, businessName: string): string {
  const lines = [
    `# SEO Fix Checklist — ${businessName}`,
    '',
    `Platform: ${pack.platformLabel}`,
    `Generated: ${new Date(pack.generatedAt).toLocaleDateString()}`,
    '',
    pack.summary,
    '',
    '## On-page & technical',
    '',
  ];

  const onPage = pack.checklist.filter((c) => c.category !== 'off_page');
  for (const item of onPage) {
    lines.push(`- [ ] **${item.title}** (${item.effort})`);
    lines.push(`  ${item.description}`);
    lines.push('');
  }

  if (pack.offPageActions.length > 0) {
    lines.push('## Off-page actions', '');
    for (const action of pack.offPageActions) {
      lines.push(`- [ ] **${action.title}**`);
      lines.push(`  ${action.description}`);
      if (action.template) {
        lines.push(`  Template: ${action.template}`);
      }
      lines.push('');
    }
  }

  if (pack.copyPaste.length > 0) {
    lines.push('## Copy-paste values', '');
    for (const item of pack.copyPaste) {
      lines.push(`### ${item.field} — ${item.pageUrl}`);
      lines.push(`Current: ${item.current || '(empty)'}`);
      lines.push(`Recommended: ${item.recommended}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}
