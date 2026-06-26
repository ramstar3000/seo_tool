export { detectSitePlatform, getPlatformInfo, isNoCodePlatform } from '@/lib/fix-pack/platforms';
export type {
  AuditFixPack,
  AuditFixPackRecord,
  ChecklistItem,
  ContentDiff,
  CopyPasteItem,
  FindingPlaybook,
  OffPageAction,
  SchemaSnippet,
  SitePlatformId,
} from '@/lib/fix-pack/types';
export { fixPackToChecklistMarkdown } from '@/lib/fix-pack/checklist-export';
