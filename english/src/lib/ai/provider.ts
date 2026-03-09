import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export function getModel() {
  const provider = process.env.AI_PROVIDER ?? 'openai';

  switch (provider) {
    case 'openai':
      return openai(process.env.AI_MODEL ?? 'gpt-4o');
    case 'anthropic':
      return anthropic(process.env.AI_MODEL ?? 'claude-sonnet-4-20250514');
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
