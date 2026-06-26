import { anthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getAnthropicApiKey, getGeminiApiKey, getGeminiModel } from '@/lib/env';

function getGoogleProvider() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');
  return createGoogleGenerativeAI({ apiKey });
}

export type LlmProvider = 'gemini' | 'anthropic';

export function getActiveLlmProvider(): LlmProvider | null {
  if (getGeminiApiKey()) return 'gemini';
  if (getAnthropicApiKey()) return 'anthropic';
  return null;
}

export function isResearchLlmConfigured(): boolean {
  return getActiveLlmProvider() !== null;
}

/** @deprecated Use isResearchLlmConfigured */
export function isAnthropicConfigured(): boolean {
  return isResearchLlmConfigured();
}

export function getActiveModelId(): string {
  const provider = getActiveLlmProvider();
  if (provider === 'gemini') return getGeminiModel();
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';
  }
  throw new Error(
    'No LLM provider configured (set GEMINI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY)',
  );
}

export function getResearchModel(): LanguageModel {
  const provider = getActiveLlmProvider();
  if (provider === 'gemini') {
    return getGoogleProvider()(getGeminiModel());
  }
  if (provider === 'anthropic') {
    const modelId = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';
    return anthropic(modelId);
  }
  throw new Error(
    'No LLM provider configured (set GEMINI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY)',
  );
}
