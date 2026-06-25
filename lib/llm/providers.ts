import { getAnthropicClient, RESEARCH_AGENT_MODEL } from '@/lib/anthropic/client';

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

const SECRET_PATTERNS = [/sk-[a-zA-Z0-9_-]+/g, /sk-ant-[a-zA-Z0-9_-]+/g];

function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
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

async function runAnthropicOptimization(prompt: string): Promise<OptimizeDecision> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: RESEARCH_AGENT_MODEL,
      max_tokens: 1024,
      system: 'Respond with valid JSON only. Do not include markdown fences or extra commentary.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : undefined;

    if (typeof content !== 'string') {
      throw new Error('Invalid optimization response');
    }

    return parseOptimizeDecision(extractJsonContent(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Anthropic request failed';
    throw new Error(sanitizeErrorMessage(message));
  }
}

export async function runOptimizationLLM(prompt: string): Promise<OptimizeDecision> {
  return runAnthropicOptimization(prompt);
}

export { RESEARCH_AGENT_MODEL as ANTHROPIC_MODEL };
