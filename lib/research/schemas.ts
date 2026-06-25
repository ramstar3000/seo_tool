import { z } from 'zod';

export const findingSeveritySchema = z.enum(['critical', 'warning', 'info']);
export const findingCategorySchema = z.enum([
  'seo',
  'messaging',
  'cro',
  'technical',
  'competitive',
  'social',
]);

export const saveFindingInputSchema = z.object({
  severity: findingSeveritySchema,
  category: findingCategorySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const finalizeAuditInputSchema = z.object({
  summary: z.string().min(1).max(3000),
  recommendations: z.string().min(1).max(5000),
});

export const findCompetitorsInputSchema = z.object({
  keyword: z.string().min(1).max(200),
  location: z.string().max(100).optional(),
});

export const scrapePageSeoInputSchema = z.object({
  url: z.string().url(),
  page_type: z.string().max(50).optional(),
  is_target: z.boolean().optional(),
});

export const discoverSiblingPagesInputSchema = z.object({
  url: z.string().url(),
  max_pages: z.number().int().min(1).max(20).optional(),
});

export const compareMessagingInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
});

export const checkSerpAdsInputSchema = z.object({
  keyword: z.string().min(1).max(200),
});

export const checkSocialPresenceInputSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  location: z.string().max(100).optional(),
  websiteUrl: z.string().url().optional(),
});

export const auditReportSchema = z.object({
  summary: z.string(),
  recommendations: z.string(),
});

export const messagingAnalysisSchema = z.object({
  inconsistencies: z.array(
    z.object({
      type: z.string(),
      pages: z.array(z.string()),
      description: z.string(),
      recommendation: z.string(),
    })
  ),
});

export type SaveFindingInput = z.infer<typeof saveFindingInputSchema>;
export type FinalizeAuditInput = z.infer<typeof finalizeAuditInputSchema>;
export type FindCompetitorsInput = z.infer<typeof findCompetitorsInputSchema>;
export type ScrapePageSeoInput = z.infer<typeof scrapePageSeoInputSchema>;
export type DiscoverSiblingPagesInput = z.infer<typeof discoverSiblingPagesInputSchema>;
export type CompareMessagingInput = z.infer<typeof compareMessagingInputSchema>;
export type CheckSerpAdsInput = z.infer<typeof checkSerpAdsInputSchema>;
export type CheckSocialPresenceInput = z.infer<typeof checkSocialPresenceInputSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;
