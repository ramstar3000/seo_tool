export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'dismissed';

export interface Lead {
  id: string;
  business_name: string;
  category: string | null;
  location: string;
  keyword: string;
  rank_position: 3 | 4;
  website_url: string | null;
  google_maps_url: string | null;
  phone: string | null;
  address: string | null;
  lead_score: number;
  status: LeadStatus;
  notes: string | null;
  recommendation: string | null;
  last_audit_id: string | null;
  audit_status?: string | null;
  audit_tier?: 'light' | 'full' | null;
  auto_pr?: { pr_url: string; pr_number: number | null; audit_id: string } | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInsert {
  business_name: string;
  category?: string | null;
  location?: string;
  keyword: string;
  rank_position: 3 | 4;
  website_url?: string | null;
  google_maps_url?: string | null;
  phone?: string | null;
  address?: string | null;
  lead_score?: number;
  status?: LeadStatus;
  notes?: string | null;
  recommendation?: string | null;
}

export interface DiscoveryRun {
  id: string;
  keywords_searched: string[];
  leads_found: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface DiscoverResult {
  leads: LeadInsert[];
  keywordsSearched: string[];
  source: 'tavily' | 'fallback';
  inserted: number;
  insertedLeadIds: string[];
}
