import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditFixPack, AuditFixPackRecord } from '@/lib/fix-pack/types';

export async function getFixPackByAuditId(
  supabase: SupabaseClient,
  auditId: string
): Promise<AuditFixPackRecord | null> {
  const { data, error } = await supabase
    .from('audit_fix_packs')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string,
    audit_id: data.audit_id as string,
    platform_id: data.platform_id as AuditFixPackRecord['platform_id'],
    platform_label: data.platform_label as string,
    pack_json: data.pack_json as AuditFixPack,
    status: data.status as AuditFixPackRecord['status'],
    error_message: (data.error_message as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

export async function saveFixPack(
  supabase: SupabaseClient,
  auditId: string,
  pack: AuditFixPack
): Promise<AuditFixPackRecord> {
  const { data, error } = await supabase
    .from('audit_fix_packs')
    .upsert(
      {
        audit_id: auditId,
        platform_id: pack.platformId,
        platform_label: pack.platformLabel,
        pack_json: pack,
        status: 'completed',
        error_message: null,
      },
      { onConflict: 'audit_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save fix pack');
  }

  return {
    id: data.id as string,
    audit_id: data.audit_id as string,
    platform_id: data.platform_id as AuditFixPackRecord['platform_id'],
    platform_label: data.platform_label as string,
    pack_json: data.pack_json as AuditFixPack,
    status: data.status as AuditFixPackRecord['status'],
    error_message: (data.error_message as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

export async function markFixPackFailed(
  supabase: SupabaseClient,
  auditId: string,
  message: string,
  platformId = 'unknown',
  platformLabel = 'Unknown platform'
): Promise<void> {
  await supabase.from('audit_fix_packs').upsert(
    {
      audit_id: auditId,
      platform_id: platformId,
      platform_label: platformLabel,
      pack_json: {},
      status: 'failed',
      error_message: message.slice(0, 500),
    },
    { onConflict: 'audit_id' }
  );
}

export async function markFixPackPending(
  supabase: SupabaseClient,
  auditId: string,
  platformId: string,
  platformLabel: string
): Promise<void> {
  await supabase.from('audit_fix_packs').upsert(
    {
      audit_id: auditId,
      platform_id: platformId,
      platform_label: platformLabel,
      pack_json: {},
      status: 'pending',
      error_message: null,
    },
    { onConflict: 'audit_id' }
  );
}
