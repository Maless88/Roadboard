import { OpenAIProvider, parseSseDeltas } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import type { ChatProvider } from './types';

export * from './types';
export { OpenAIProvider, AnthropicProvider, OllamaProvider, parseSseDeltas };


export type ProviderName = 'openai' | 'anthropic' | 'ollama';


export function getProvider(name: ProviderName): ChatProvider {

  switch (name) {

    case 'openai':
      return new OpenAIProvider();

    case 'anthropic':
      return new AnthropicProvider();

    case 'ollama':
      return new OllamaProvider();

    default: {

      const _exhaustive: never = name;
      throw new Error(`Unknown chatbot provider: ${String(_exhaustive)}`);
    }
  }
}


export const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
  ollama: 'llama3.2',
};
