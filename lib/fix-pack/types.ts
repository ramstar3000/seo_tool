export type SitePlatformId =
  | 'webflow'
  | 'wix'
  | 'squarespace'
  | 'shopify'
  | 'wordpress'
  | 'framer'
  | 'carrd'
  | 'bubble'
  | 'github_pages'
  | 'custom'
  | 'unknown';

export type FixEffort = 'quick' | 'medium' | 'manual';

export type ChecklistCategory = 'on_page' | 'technical' | 'schema' | 'off_page';

export interface CopyPasteItem {
  field: string;
  pageUrl: string;
  current: string;
  recommended: string;
  notes?: string;
}

export interface SchemaSnippet {
  name: string;
  description: string;
  injectionPoint: string;
  jsonLd: string;
}

export interface PlatformPlaybookStep {
  order: number;
  instruction: string;
}

export interface FindingPlaybook {
  findingTitle: string;
  effort: FixEffort;
  steps: PlatformPlaybookStep[];
  copyPaste?: string;
}

export interface ContentDiff {
  field: string;
  pageUrl: string;
  before: string;
  after: string;
  rationale: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  effort: FixEffort;
  category: ChecklistCategory;
}

export interface OffPageAction {
  title: string;
  description: string;
  template?: string;
  platform?: string;
}

export interface AuditFixPack {
  platformId: SitePlatformId;
  platformLabel: string;
  platformSupportsCodeInjection: boolean;
  summary: string;
  copyPaste: CopyPasteItem[];
  schemaSnippets: SchemaSnippet[];
  diffs: ContentDiff[];
  playbooks: FindingPlaybook[];
  checklist: ChecklistItem[];
  offPageActions: OffPageAction[];
  generatedAt: string;
}

export interface AuditFixPackRecord {
  id: string;
  audit_id: string;
  platform_id: SitePlatformId;
  platform_label: string;
  pack_json: AuditFixPack;
  status: 'pending' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}
