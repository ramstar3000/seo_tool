import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from '@/lib/env';

let client: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return Boolean(getAnthropicApiKey());
}

export function getAnthropicClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  if (!client) {
    client = new Anthropic({ apiKey });
  }

  return client;
}

/** Override with ANTHROPIC_MODEL env var if Anthropic deprecates this id. */
export const RESEARCH_AGENT_MODEL =
  process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';
