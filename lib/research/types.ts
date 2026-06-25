export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export type FindingCategory = 'seo' | 'messaging' | 'cro' | 'technical' | 'competitive' | 'social';

export interface SeoSignals {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  canonical: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  jsonLd: unknown[];
  ctas: string[];
  wordCount: number;
}

export interface AuditFinding {
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
}

export interface AuditCompetitor {
  rank_position: number;
  business_name: string;
  url: string;
  title: string;
  snippet: string | null;
}

export interface AuditPage {
  url: string;
  is_target: boolean;
  page_type: string;
  seo_json: SeoSignals;
  scraped_at: string;
}

export interface ToolTraceEntry {
  turn: number;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface SiteAudit {
  id: string;
  lead_id: string | null;
  target_url: string;
  keyword: string;
  business_name: string;
  status: AuditStatus;
  summary: string | null;
  recommendations: string | null;
  tool_trace: ToolTraceEntry[];
  created_at: string;
  completed_at: string | null;
}

export interface ToolContext {
  targetUrl: string;
  keyword: string;
  businessName: string;
  location: string;
  findings: AuditFinding[];
  pages: Map<string, SeoSignals>;
  competitors: AuditCompetitor[];
  socialProfiles: AuditSocialProfile[];
  socialInconsistencies: SocialMessagingIssue[];
  socialSearched: boolean;
  scrapeCount: number;
  maxScrapes: number;
  finalized: boolean;
  summary: string | null;
  recommendations: string | null;
}

export interface ResearchAgentResult {
  audit: Omit<SiteAudit, 'id' | 'created_at'>;
  competitors: AuditCompetitor[];
  pages: AuditPage[];
  findings: AuditFinding[];
  socialProfiles: AuditSocialProfile[];
  toolTrace: ToolTraceEntry[];
}

export interface MessagingInconsistency {
  type: string;
  pages: string[];
  description: string;
  recommendation: string;
}

export interface SerpAd {
  position: number;
  title: string;
  link: string;
  snippet: string | null;
}

export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  snippet: string | null;
}

export interface SocialSeoSignals {
  url: string;
  platformId: string;
  platformName: string;
  title: string | null;
  description: string | null;
  bio: string | null;
  phone: string | null;
  cta: string | null;
}

export type SocialProfileStatus = 'found' | 'missing' | 'not_searched' | 'error';

export interface AuditSocialProfile {
  platform_id: string;
  profile_url: string | null;
  bio_text: string | null;
  seo_json: SocialSeoSignals | null;
  found_via: 'serp' | 'website_link' | null;
  status: SocialProfileStatus;
}

export interface SocialMessagingIssue {
  type: string;
  platforms: string[];
  description: string;
  recommendation: string;
}

export interface SocialPresenceSnapshot {
  profiles: Array<AuditSocialProfile & { platform_name: string; search_url?: string }>;
  searched: boolean;
  inconsistencies: SocialMessagingIssue[];
}
