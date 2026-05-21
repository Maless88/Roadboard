import type { ChatMessage, ChatProvider, ChatProviderConfig } from './types';
import { ProviderError } from './types';


interface OpenAIStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}


export class OpenAIProvider implements ChatProvider {

  readonly name = 'openai' as const;


  async *stream(messages: ChatMessage[], config: ChatProviderConfig): AsyncIterable<string> {

    if (!config.apiKey) {
      throw new ProviderError('OpenAI provider requires an API key');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`OpenAI error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    yield* parseSseDeltas(res.body, (chunk: OpenAIStreamChunk) => chunk.choices?.[0]?.delta?.content);
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    if (!config.apiKey) {
      throw new ProviderError('OpenAI provider requires an API key');
    }

    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      throw new ProviderError(`OpenAI ping failed: ${res.status}`, res.status);
    }
  }
}


export async function* parseSseDeltas<T>(
  body: ReadableStream<Uint8Array>,
  pick: (chunk: T) => string | undefined,
): AsyncIterable<string> {

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {

    while (true) {

      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {

        const trimmed = line.trim();

        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();

        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as T;
          const text = pick(parsed);

          if (text) yield text;
        } catch {

          continue;
        }
      }
    }
  } finally {

    reader.releaseLock();
  }
}
