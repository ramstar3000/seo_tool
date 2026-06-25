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

export const RESEARCH_AGENT_MODEL = 'claude-3-5-haiku-latest';
