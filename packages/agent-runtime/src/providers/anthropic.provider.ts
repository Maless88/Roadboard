import type { ChatMessage, ChatProvider, ChatProviderConfig } from './types';
import { ProviderError } from './types';


interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}


export class AnthropicProvider implements ChatProvider {

  readonly name = 'anthropic' as const;


  async *stream(messages: ChatMessage[], config: ChatProviderConfig): AsyncIterable<string> {

    if (!config.apiKey) {
      throw new ProviderError('Anthropic provider requires an API key');
    }

    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const turnMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        system: system || undefined,
        messages: turnMessages,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Anthropic error ${res.status}: ${body.slice(0, 200)}`, res.status);
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

          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();

          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as AnthropicStreamEvent;

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {

            continue;
          }
        }
      }
    } finally {

      reader.releaseLock();
    }
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    if (!config.apiKey) {
      throw new ProviderError('Anthropic provider requires an API key');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Anthropic ping failed: ${res.status} ${body.slice(0, 200)}`, res.status);
    }
  }
}
