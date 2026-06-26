import { NextResponse } from 'next/server';
import { getLlmSpendCapUsd } from '@/lib/cost/limits';
import { getGlobalSpendUsd, getLlmSpendUsd } from '@/lib/cost/tracker';
import { getActiveLlmProvider, getActiveModelId, isResearchLlmConfigured } from '@/lib/llm/client';
import { getGlobalSpendCapUsd, hasSupabaseConfig, hasTavilyConfig } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checkSupabaseSchema } from '@/lib/supabase/schema-health';

export const runtime = 'nodejs';

export async function GET() {
  const supabaseConfigured = hasSupabaseConfig();
  const llmConfigured = isResearchLlmConfigured();
  const llmProvider = getActiveLlmProvider();
  const llmSpendCapUsd = getLlmSpendCapUsd();
  const llmSpendUsd = llmConfigured
    ? Math.round((await getLlmSpendUsd()) * 1e4) / 1e4
    : null;
  const globalSpendUsd = Math.round((await getGlobalSpendUsd()) * 1e4) / 1e4;
  const globalCapUsd = getGlobalSpendCapUsd();

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
      llmSpendUsd,
      llmSpendCapUsd: llmConfigured ? llmSpendCapUsd : null,
      tavily: hasTavilyConfig(),
      cost: {
        spendUsd: globalSpendUsd,
        capUsd: globalCapUsd,
        capped: globalCapUsd !== null && globalSpendUsd >= globalCapUsd,
        llmSpendUsd,
        llmCapUsd: llmConfigured ? llmSpendCapUsd : null,
        llmCapped: llmConfigured && llmSpendUsd !== null && llmSpendUsd >= llmSpendCapUsd,
      },
      schema: schemaOk,
      /** @deprecated use config.llm */
      anthropic: llmConfigured,
    },
    ...(missingTables.length > 0
      ? { schemaHint: 'Run supabase/schema.sql in the Supabase SQL Editor', missingTables }
      : {}),
  });
}
