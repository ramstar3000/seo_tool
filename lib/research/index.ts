export { runResearchAgent } from '@/lib/research/agent';
export type { RunResearchAgentParams } from '@/lib/research/offline-audit';
export { runOfflineResearchAudit } from '@/lib/research/offline-audit';
export { fetchPageContent } from '@/lib/research/fetch-page';
export type { FetchPageResult } from '@/lib/research/fetch-page';
export { extractSeoSignals } from '@/lib/research/seo-extract';
export {
  discoverInternalPages,
  discoverSitemapUrls,
  findSiblingPages,
} from '@/lib/research/sitemap';
export {
  findCompetitors,
  fetchSerpLeadsForKeyword,
  getSerpAds,
  parseBusinessName,
  searchGoogle,
} from '@/lib/research/serp';
export type { SerpSearchOptions } from '@/lib/research/serp';
export { comparePageMessaging } from '@/lib/research/messaging';
export {
  SOCIAL_REFERENCE_PLATFORMS,
  buildProfileSearchUrl,
  getPlatformById,
  matchPlatformFromUrl,
} from '@/lib/research/social-platforms';
export type { SocialReferencePlatform } from '@/lib/research/social-platforms';
export {
  checkSocialPresence,
  compareSocialMessaging,
  discoverSocialProfiles,
  extractSocialSeoSignals,
} from '@/lib/research/social-presence';
export type {
  DiscoveredSocialProfile,
  SocialPresenceResult,
  SocialProfileStatus,
} from '@/lib/research/social-presence';
export {
  ANTHROPIC_TOOL_DEFINITIONS,
  MAX_AGENT_TURNS,
  MAX_PAGE_SCRAPES,
  executeTool,
  runToolWithTrace,
} from '@/lib/research/tools';
export {
  saveAuditToSupabase,
  getAuditById,
  listRecentAudits,
  findAuditByLeadId,
  createPendingAudit,
  markAuditFailed,
  getSocialSummaryByLeadId,
  persistResearchAudit,
} from '@/lib/research/persist';
export type { SavedAudit, AuditDetail } from '@/lib/research/persist';
export * from '@/lib/research/schemas';
export * from '@/lib/research/types';
