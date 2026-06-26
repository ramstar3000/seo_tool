import type { PlatformInfo } from '@/lib/fix-pack/platforms';
import { buildSeoLlmPromptBlock, buildSiteContextHint } from '@/lib/prompts/seo-llm-knowledge';
import type { SeoSignals } from '@/lib/research/types';

export const FIX_PACK_SYSTEM_PROMPT = `You are SynapseCRO's no-code implementation assistant. Given audit findings and scraped page SEO signals, produce a fix pack the site owner can apply manually in their website builder — without access to source code or GitHub.

Output structured JSON with:
- summary: 2–3 sentences on what to fix first and estimated effort
- copyPaste: ready-to-paste title tags, meta descriptions, H1 text, alt text, CTA copy, opening paragraphs (use exact recommended text)
- schemaSnippets: valid JSON-LD blocks with injectionPoint tailored to the platform
- diffs: before/after for each on-page change (before = current scraped value; after = recommended)
- playbooks: one entry per major finding with numbered platform-specific steps (use the platform navigation hints provided)
- checklist: actionable checkbox items grouped by effort (quick/medium/manual) and category
- offPageActions: GBP, reviews, directories, social bios — with optional copy templates

Rules:
- Base every recommendation on the findings and scraped page data — do not invent issues
- Use the detected platform's admin UI paths in playbook steps (not generic "edit your site")
- Keep copyPaste.recommended concise and within typical SEO limits (title ~60 chars, meta ~160)
- JSON-LD must be valid JSON (no trailing commas, no comments)
- Maximum 8 copyPaste items, 3 schema snippets, 12 checklist items, 6 off-page actions
- For local businesses only: include LocalBusiness schema when findings support it
- Never recommend fake addresses, borough landing pages, or tactics inappropriate to site type
${buildSeoLlmPromptBlock('edit')}`;

export function buildFixPackUserPrompt(params: {
  businessName: string;
  keyword: string;
  targetUrl: string;
  platform: PlatformInfo;
  findings: Array<{ severity: string; category: string; title: string; description: string }>;
  pages: Array<{ url: string; is_target: boolean; page_type: string; seo: SeoSignals }>;
  recommendations?: string | null;
  seoContext?: string;
}): string {
  const { businessName, keyword, targetUrl, platform, findings, pages, recommendations, seoContext } =
    params;

  const findingsBlock =
    findings.length > 0
      ? findings.map((f) => `[${f.severity}/${f.category}] ${f.title}: ${f.description}`).join('\n')
      : 'No findings provided.';

  const pagesBlock =
    pages.length > 0
      ? pages
          .map((p) => {
            const s = p.seo;
            return [
              `URL: ${p.url} (${p.page_type}${p.is_target ? ', target page' : ''})`,
              `  title: ${s.title ?? '(missing)'}`,
              `  meta: ${s.metaDescription ?? '(missing)'}`,
              `  h1: ${s.h1.join(' | ') || '(missing)'}`,
              `  h2: ${s.h2.slice(0, 5).join(' | ') || '(none)'}`,
              `  canonical: ${s.canonical ?? '(missing)'}`,
              `  robots: ${s.robots ?? '(missing)'}`,
              `  og:title: ${s.ogTitle ?? '(missing)'}`,
              `  ctas: ${s.ctas.slice(0, 5).join(' | ') || '(none)'}`,
              `  wordCount: ${s.wordCount}`,
              `  jsonLd types: ${s.jsonLd.length > 0 ? s.jsonLd.map((j) => (j as { '@type'?: string })['@type'] ?? 'unknown').join(', ') : '(none)'}`,
            ].join('\n');
          })
          .join('\n\n')
      : 'No scraped pages available.';

  const seoBlock = seoContext?.trim()
    ? `\nHistorical SEO context:\n${seoContext.trim()}\n`
    : '';

  return `${buildSiteContextHint({ businessName, keyword })}
Website: ${targetUrl}
Detected platform: ${platform.label}
Platform SEO settings: ${platform.seoSettingsHint}
Custom code / schema injection: ${platform.customCodeHint}
Playbook style: ${platform.playbookPreamble}
${seoBlock}
Executive recommendations:
${recommendations?.trim() || 'Not available.'}

Audit findings:
${findingsBlock}

Scraped page SEO signals:
${pagesBlock}

Produce a complete fix pack for ${platform.label}. Playbook steps must reference ${platform.label}'s actual admin UI (e.g. "${platform.seoSettingsHint}").`;
}
