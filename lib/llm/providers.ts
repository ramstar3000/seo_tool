import { runLlmText } from '@/lib/llm/generate';

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

function parseOptimizeDecision(raw: unknown): OptimizeDecision {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid optimization response');
  }

  const decision = raw as Partial<OptimizeDecision>;
  if (
    typeof decision.thought_process !== 'string' ||
    typeof decision.action_taken !== 'string' ||
    !decision.updates ||
    typeof decision.updates !== 'object'
  ) {
    throw new Error('Invalid optimization response');
  }

  return {
    thought_process: decision.thought_process,
    action_taken: decision.action_taken,
    updates: decision.updates,
  };
}

function extractJsonContent(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim());
    }
    throw new Error('Invalid optimization response');
  }
}

export async function runOptimizationLLM(prompt: string): Promise<OptimizeDecision> {
  const content = await runLlmText({
    system: 'Respond with valid JSON only. Do not include markdown fences or extra commentary.',
    prompt,
    maxOutputTokens: 1024,
  });

  return parseOptimizeDecision(extractJsonContent(content));
}
