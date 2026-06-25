import type { ChatMessage, ChatProvider, ChatProviderConfig } from './types';
import { ProviderError } from './types';


interface OllamaStreamLine {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}


export class OllamaProvider implements ChatProvider {

  readonly name = 'ollama' as const;


  async *stream(messages: ChatMessage[], config: ChatProviderConfig): AsyncIterable<string> {

    if (!config.baseUrl) {
      throw new ProviderError('Ollama provider requires baseUrl');
    }

    const url = `${config.baseUrl.replace(/\/$/, '')}/api/chat`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Ollama error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const reader = res.body.getReader();
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

          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as OllamaStreamLine;

            if (parsed.error) {
              throw new ProviderError(`Ollama error: ${parsed.error}`);
            }

            if (parsed.message?.content) {
              yield parsed.message.content;
            }

            if (parsed.done) return;
          } catch (err) {

            if (err instanceof ProviderError) throw err;

            continue;
          }
        }
      }
    } finally {

      reader.releaseLock();
    }
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    if (!config.baseUrl) {
      throw new ProviderError('Ollama provider requires baseUrl');
    }

    const url = `${config.baseUrl.replace(/\/$/, '')}/api/tags`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new ProviderError(`Ollama ping failed: ${res.status}`, res.status);
    }
  }
}
