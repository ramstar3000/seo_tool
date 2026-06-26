import { isResearchLlmConfigured } from '@/lib/llm/client';
import { runLlmObject } from '@/lib/llm/generate';
import {
  buildMessagingAnalysisUserPrompt,
  MESSAGING_ANALYSIS_SYSTEM_PROMPT,
} from '@/lib/prompts/messaging-analysis';
import { messagingAnalysisSchema } from '@/lib/research/schemas';
import type { MessagingInconsistency, SeoSignals } from '@/lib/research/types';

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function detectHeuristicInconsistencies(pages: SeoSignals[]): MessagingInconsistency[] {
  const inconsistencies: MessagingInconsistency[] = [];

  for (const page of pages) {
    const h1 = page.h1[0];
    if (h1 && page.title && normalize(h1) !== normalize(page.title)) {
      inconsistencies.push({
        type: 'h1_title_mismatch',
        pages: [page.url],
        description: `H1 ("${h1}") differs from title tag ("${page.title}")`,
        recommendation: 'Align H1 and title tag for consistent messaging and SEO.',
      });
    }

    if (page.h1.length === 0) {
      inconsistencies.push({
        type: 'missing_h1',
        pages: [page.url],
        description: 'Page has no H1 heading',
        recommendation: 'Add a clear H1 that states the primary value proposition.',
      });
    }

    if (!page.metaDescription) {
      inconsistencies.push({
        type: 'missing_meta',
        pages: [page.url],
        description: 'Missing meta description',
        recommendation: 'Write a compelling meta description with the target keyword.',
      });
    }
  }

  if (pages.length >= 2) {
    const h1Sets = pages.map((p) => ({ url: p.url, h1: normalize(p.h1[0]) })).filter((p) => p.h1);
    const uniqueH1s = new Set(h1Sets.map((p) => p.h1));

    if (uniqueH1s.size > 1 && uniqueH1s.size >= pages.length * 0.5) {
      inconsistencies.push({
        type: 'cross_page_h1_drift',
        pages: h1Sets.map((p) => p.url),
        description: 'H1 headings vary significantly across pages without clear hierarchy',
        recommendation: 'Establish consistent brand messaging with page-specific H1s that share a core value prop.',
      });
    }

    const ctaSets = pages.map((p) => ({ url: p.url, ctas: p.ctas.map(normalize).filter(Boolean) }));
    const allCtas = new Set(ctaSets.flatMap((p) => p.ctas));
    if (allCtas.size > 4) {
      inconsistencies.push({
        type: 'cta_fragmentation',
        pages: ctaSets.filter((p) => p.ctas.length > 0).map((p) => p.url),
        description: `Found ${allCtas.size} different CTA phrases across pages`,
        recommendation: 'Standardize primary CTA language to reduce decision friction.',
      });
    }
  }

  return inconsistencies;
}

export async function comparePageMessaging(pages: SeoSignals[]): Promise<MessagingInconsistency[]> {
  if (pages.length === 0) return [];

  const heuristic = detectHeuristicInconsistencies(pages);

  if (pages.length < 2 || !isResearchLlmConfigured()) {
    return heuristic;
  }

  try {
    const object = await runLlmObject({
      schema: messagingAnalysisSchema,
      system: MESSAGING_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildMessagingAnalysisUserPrompt(
        pages.map((p) => ({
          url: p.url,
          title: p.title,
          metaDescription: p.metaDescription,
          h1: p.h1,
          ctas: p.ctas,
        }))
      ),
    });

    const llmInconsistencies = object.inconsistencies.map((item) => ({
      type: item.type,
      pages: item.pages,
      description: item.description,
      recommendation: item.recommendation,
    }));

    const seen = new Set(heuristic.map((h) => `${h.type}:${h.pages.sort().join(',')}`));
    for (const item of llmInconsistencies) {
      const key = `${item.type}:${item.pages.sort().join(',')}`;
      if (!seen.has(key)) {
        heuristic.push(item);
        seen.add(key);
      }
    }
  } catch {
    // Heuristic results are sufficient when LLM synthesis fails
  }

  return heuristic;
}
