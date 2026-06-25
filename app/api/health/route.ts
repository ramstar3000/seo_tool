import { NextResponse } from 'next/server';
import { hasAnthropicConfig, hasSupabaseConfig } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checkSupabaseSchema } from '@/lib/supabase/schema-health';

export const runtime = 'nodejs';

export async function GET() {
  const supabaseConfigured = hasSupabaseConfig();
  const anthropicConfigured = hasAnthropicConfig();

  let schemaOk: boolean | null = null;
  let missingTables: string[] = [];

  if (supabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const schema = await checkSupabaseSchema(supabase);
      schemaOk = schema.ok;
      missingTables = schema.missingTables;
    }
  }

  return NextResponse.json({
    ok: true,
    service: 'synapsecro',
    config: {
      supabase: supabaseConfigured,
      anthropic: anthropicConfigured,
      schema: schemaOk,
    },
    ...(missingTables.length > 0
      ? { schemaHint: 'Run supabase/schema.sql in the Supabase SQL Editor', missingTables }
      : {}),
  });
}
