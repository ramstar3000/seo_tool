import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateFixPackForAuditId } from '@/lib/fix-pack/generate';
import { detectSitePlatform } from '@/lib/fix-pack/platforms';
import {
  getFixPackByAuditId,
  markFixPackFailed,
  markFixPackPending,
  saveFixPack,
} from '@/lib/fix-pack/persist';

export async function autoGenerateFixPackFromAudit(params: {
  supabase: SupabaseClient;
  auditId: string;
  targetUrl: string;
}): Promise<void> {
  const { supabase, auditId, targetUrl } = params;

  const existing = await getFixPackByAuditId(supabase, auditId);
  if (existing?.status === 'completed') return;

  const { data: pages } = await supabase
    .from('audit_pages')
    .select('seo_json')
    .eq('audit_id', auditId);

  const platform = detectSitePlatform(
    targetUrl,
    (pages ?? []).map((p) => ({ seo_json: p.seo_json as import('@/lib/research/types').SeoSignals }))
  );

  await markFixPackPending(supabase, auditId, platform.id, platform.label);

  try {
    const pack = await generateFixPackForAuditId(supabase, auditId);
    await saveFixPack(supabase, auditId, pack);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fix pack generation failed';
    await markFixPackFailed(supabase, auditId, message, platform.id, platform.label);
    throw err;
  }
}
