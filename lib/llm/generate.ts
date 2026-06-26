import { generateObject, generateText, type ToolSet } from 'ai';
import type { z } from 'zod';
import { getResearchModel } from '@/lib/llm/client';
import { hasLangfuseConfig } from '@/lib/langfuse/client';
import {
  assertLlmSpendCapNotExceeded,
  LlmSpendCapExceededError,
  recordLlmUsage,
} from '@/lib/llm/usage-cap';

const SECRET_PATTERNS = [/sk-[a-zA-Z0-9_-]+/g, /sk-ant-[a-zA-Z0-9_-]+/g, /AIza[a-zA-Z0-9_-]+/g];

export interface LlmTelemetryOptions {
  functionId: string;
}

function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function wrapLlmError(error: unknown): never {
  if (error instanceof LlmSpendCapExceededError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : 'LLM request failed';
  throw new Error(sanitizeErrorMessage(message));
}

function telemetryFor(functionId: string) {
  if (!hasLangfuseConfig()) return undefined;
  return { functionId };
}

export async function runLlmText(params: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  telemetry?: LlmTelemetryOptions;
}): Promise<string> {
  try {
    await assertLlmSpendCapNotExceeded();
    const result = await generateText({
      model: getResearchModel(),
      system: params.system,
      prompt: params.prompt,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
      telemetry: telemetryFor(params.telemetry?.functionId ?? 'llm-text'),
    });
    await recordLlmUsage(result.totalUsage);
    return result.text.trim();
  } catch (error) {
    wrapLlmError(error);
  }
}

export async function runLlmObject<T extends z.ZodType>(params: {
  system: string;
  prompt: string;
  schema: T;
  telemetry?: LlmTelemetryOptions;
}): Promise<z.infer<T>> {
  try {
    await assertLlmSpendCapNotExceeded();
    const result = await generateObject({
      model: getResearchModel(),
      schema: params.schema,
      system: params.system,
      prompt: params.prompt,
      telemetry: telemetryFor(params.telemetry?.functionId ?? 'llm-object'),
    });
    await recordLlmUsage(result.usage);
    return result.object as z.infer<T>;
  } catch (error) {
    wrapLlmError(error);
  }
}

/** Agent multi-step generateText — same spend cap and usage recording as runLlmText. */
export async function runLlmAgentGenerateText<TOOLS extends ToolSet>(
  params: Parameters<typeof generateText<TOOLS>>[0] & { telemetry?: LlmTelemetryOptions }
): Promise<Awaited<ReturnType<typeof generateText<TOOLS>>>> {
  const { telemetry, ...rest } = params;
  try {
    await assertLlmSpendCapNotExceeded();
    const result = await generateText({
      ...rest,
      telemetry: telemetryFor(telemetry?.functionId ?? 'llm-agent'),
    });
    await recordLlmUsage(result.totalUsage);
    return result as Awaited<ReturnType<typeof generateText<TOOLS>>>;
  } catch (error) {
    wrapLlmError(error);
  }
}

export { LlmSpendCapExceededError };
