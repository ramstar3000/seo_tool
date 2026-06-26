import { NextResponse } from 'next/server';
import { getActiveLlmProvider, getActiveModelId, isResearchLlmConfigured } from '@/lib/llm/client';
import { hasSupabaseConfig, hasTavilyConfig } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checkSupabaseSchema } from '@/lib/supabase/schema-health';

export const runtime = 'nodejs';

export async function GET() {
  const supabaseConfigured = hasSupabaseConfig();
  const llmConfigured = isResearchLlmConfigured();
  const llmProvider = getActiveLlmProvider();

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
      llm: llmConfigured,
      llmProvider,
      llmModel: llmConfigured ? getActiveModelId() : null,
      tavily: hasTavilyConfig(),
      schema: schemaOk,
      /** @deprecated use config.llm */
      anthropic: llmConfigured,
    },
    ...(missingTables.length > 0
      ? { schemaHint: 'Run supabase/schema.sql in the Supabase SQL Editor', missingTables }
      : {}),
  });
}
