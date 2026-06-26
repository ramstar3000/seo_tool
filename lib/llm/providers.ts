import { z } from 'zod';
import { runLlmObject } from '@/lib/llm/generate';

export interface OptimizeDecision {
  thought_process: string;
  action_taken: string;
  updates: {
    hero_title?: string;
    hero_subtitle?: string;
    cta_text?: string;
    [key: string]: string | undefined;
  };
}

const optimizeDecisionSchema = z.object({
  thought_process: z.string(),
  action_taken: z.string(),
  updates: z.record(z.string(), z.string().optional()),
});

export async function runOptimizationLLM(prompt: string): Promise<OptimizeDecision> {
  const decision = await runLlmObject({
    system:
      'You are a CRO agent. Return structured JSON with thought_process, action_taken, and updates.',
    prompt,
    schema: optimizeDecisionSchema,
    telemetry: { functionId: 'cro-optimizer' },
  });

  return {
    thought_process: decision.thought_process,
    action_taken: decision.action_taken,
    updates: decision.updates,
  };
}
