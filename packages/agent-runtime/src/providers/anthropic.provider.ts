import type { ChatMessage, ChatProvider, ChatProviderConfig } from './types';
import { ProviderError } from './types';
import { parseSseDeltas } from './openai.provider';


export interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}


/**
 * Picks the incremental text from an Anthropic Messages SSE event. Only
 * `content_block_delta` events carry `delta.text`; every other event type
 * (message_start, content_block_start/stop, message_delta/stop, ping) yields
 * nothing. Shared between the legacy `AnthropicProvider` and the native
 * `AnthropicAdapter` so the SSE parsing logic is never duplicated.
 */
export function pickAnthropicTextDelta(event: AnthropicStreamEvent): string | undefined {

  if (event.type === 'content_block_delta' && event.delta?.text) {
    return event.delta.text;
  }

  return undefined;
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

    yield* parseSseDeltas(res.body, pickAnthropicTextDelta);
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
