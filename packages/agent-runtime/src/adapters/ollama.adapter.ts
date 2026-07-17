import type { LlmModelDescriptor, LlmProvider, LlmRequest, LlmResponse, PrivacyClass } from '../capability/contract';
import type { ChatProviderConfig } from '../providers/types';
import { ProviderError } from '../providers/types';
import { parseNdjsonDeltas } from '../providers/ollama.provider';


export interface OllamaAdapterOptions {
  models?: readonly LlmModelDescriptor[];
}


interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
}


interface OllamaStreamLine {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}


export class OllamaAdapter implements LlmProvider {

  readonly id = 'ollama' as const;
  readonly privacyClass: PrivacyClass = 'local';
  readonly models: readonly LlmModelDescriptor[];


  constructor(options: OllamaAdapterOptions = {}) {
    this.models = options.models ?? [];
  }


  private resolveBaseUrl(config: ChatProviderConfig): string {

    if (!config.baseUrl) {
      throw new ProviderError('Ollama provider requires baseUrl');
    }

    return config.baseUrl.replace(/\/$/, '');
  }


  async complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse> {

    const baseUrl = this.resolveBaseUrl(config);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Ollama error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as OllamaChatResponse;

    return {
      content: data.message?.content ?? '',
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
      finishReason: data.done === false ? 'error' : 'stop',
    };
  }


  async *stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string> {

    const baseUrl = this.resolveBaseUrl(config);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Ollama error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    yield* parseNdjsonDeltas(res.body, (chunk: OllamaStreamLine) => ({
      text: chunk.message?.content,
      done: chunk.done,
      error: chunk.error,
    }));
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    const baseUrl = this.resolveBaseUrl(config);

    const res = await fetch(`${baseUrl}/api/tags`);

    if (!res.ok) {
      throw new ProviderError(`Ollama ping failed: ${res.status}`, res.status);
    }
  }
}
