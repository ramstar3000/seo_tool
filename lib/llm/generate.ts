import { generateObject, generateText } from 'ai';
import type { z } from 'zod';
import { getResearchModel } from '@/lib/llm/client';

const SECRET_PATTERNS = [/sk-[a-zA-Z0-9_-]+/g, /sk-ant-[a-zA-Z0-9_-]+/g, /AIza[a-zA-Z0-9_-]+/g];

function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export async function runLlmText(params: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  try {
    const { text } = await generateText({
      model: getResearchModel(),
      system: params.system,
      prompt: params.prompt,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
    });
    return text.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM request failed';
    throw new Error(sanitizeErrorMessage(message));
  }
}

export async function runLlmObject<T extends z.ZodType>(params: {
  system: string;
  prompt: string;
  schema: T;
}): Promise<z.infer<T>> {
  try {
    const { object } = await generateObject({
      model: getResearchModel(),
      schema: params.schema,
      system: params.system,
      prompt: params.prompt,
    });
    return object as z.infer<T>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM request failed';
    throw new Error(sanitizeErrorMessage(message));
  }
}
