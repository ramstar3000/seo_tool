import type { SupabaseClient } from '@supabase/supabase-js';

const REQUIRED_TABLES = [
  'audit_requests',
  'site_audits',
  'audit_findings',
  'audit_pages',
  'audit_competitors',
  'audit_social_profiles',
  'leads',
] as const;

export type SchemaHealthResult = {
  ok: boolean;
  missingTables: string[];
};

export async function checkSupabaseSchema(
  supabase: SupabaseClient
): Promise<SchemaHealthResult> {
  const missingTables: string[] = [];

  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        missingTables.push(table);
      }
    })
  );

  return { ok: missingTables.length === 0, missingTables: missingTables.sort() };
}

export function schemaNotAppliedMessage(missingTables: string[]): string {
  const preview = missingTables.slice(0, 3).join(', ');
  const suffix = missingTables.length > 3 ? ` (+${missingTables.length - 3} more)` : '';
  return `Database schema not applied. Missing tables: ${preview}${suffix}. Run supabase/schema.sql in the Supabase SQL Editor.`;
}
