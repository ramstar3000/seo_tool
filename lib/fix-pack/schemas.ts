import { z } from 'zod';

const effortSchema = z.enum(['quick', 'medium', 'manual']);
const categorySchema = z.enum(['on_page', 'technical', 'schema', 'off_page']);

export const fixPackResponseSchema = z.object({
  summary: z.string(),
  copyPaste: z.array(
    z.object({
      field: z.string(),
      pageUrl: z.string(),
      current: z.string(),
      recommended: z.string(),
      notes: z.string().optional(),
    })
  ),
  schemaSnippets: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      injectionPoint: z.string(),
      jsonLd: z.string(),
    })
  ),
  diffs: z.array(
    z.object({
      field: z.string(),
      pageUrl: z.string(),
      before: z.string(),
      after: z.string(),
      rationale: z.string(),
    })
  ),
  playbooks: z.array(
    z.object({
      findingTitle: z.string(),
      effort: effortSchema,
      steps: z.array(
        z.object({
          order: z.number().int().positive(),
          instruction: z.string(),
        })
      ),
      copyPaste: z.string().optional(),
    })
  ),
  checklist: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      effort: effortSchema,
      category: categorySchema,
    })
  ),
  offPageActions: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      template: z.string().optional(),
      platform: z.string().optional(),
    })
  ),
});

export type FixPackLlmResponse = z.infer<typeof fixPackResponseSchema>;
