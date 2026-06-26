import { z } from 'zod';
import { runLlmObject } from '@/lib/llm/generate';
import { CRO_OPTIMIZER_SYSTEM_PROMPT } from '@/lib/prompts/cro-optimizer';

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
  thought_process: z.string().min(1),
  action_taken: z.string().min(1),
  updates: z.object({
    hero_title: z.string().min(1),
    hero_subtitle: z.string().min(1),
    cta_text: z.string().min(1),
  }),
});

export async function runOptimizationLLM(prompt: string): Promise<OptimizeDecision> {
  const decision = await runLlmObject({
    system: CRO_OPTIMIZER_SYSTEM_PROMPT,
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
