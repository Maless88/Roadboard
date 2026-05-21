export type ChatRole = 'system' | 'user' | 'assistant';


export interface ChatMessage {
  role: ChatRole;
  content: string;
}


export interface ChatProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}


export interface ChatProvider {

  readonly name: 'openai' | 'anthropic' | 'ollama';

  stream(messages: ChatMessage[], config: ChatProviderConfig): AsyncIterable<string>;

  ping(config: ChatProviderConfig): Promise<void>;
}


export class ProviderError extends Error {

  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}
