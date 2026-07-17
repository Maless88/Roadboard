import { ProviderError } from '../providers/types';
import { ANTHROPIC_MODEL_CATALOG } from '../registry/model-catalog';

import { AnthropicAdapter } from './anthropic.adapter';


function sseStream(events: string[]): ReadableStream<Uint8Array> {

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {

      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }

      controller.close();
    },
  });
}


describe('AnthropicAdapter', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the Anthropic model catalog and is public-cloud', () => {
    const adapter = new AnthropicAdapter();

    expect(adapter.models).toBe(ANTHROPIC_MODEL_CATALOG);
    expect(adapter.privacyClass).toBe('public-cloud');
    expect(adapter.id).toBe('anthropic');
  });

  it('accepts an injected model catalog', () => {
    const adapter = new AnthropicAdapter({ models: [] });

    expect(adapter.models).toEqual([]);
  });

  describe('complete', () => {

    it('extracts text, usage and maps end_turn to stop; sends system + max_tokens', async () => {
      const adapter = new AnthropicAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          content: [{ type: 'text', text: 'hello' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.complete(
        {
          messages: [
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'hi' },
          ],
          maxOutputTokens: 256,
        },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      );

      expect(result).toEqual({
        content: 'hello',
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });

      const [url, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);

      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(init.headers['x-api-key']).toBe('sk-ant');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
      expect(body.system).toBe('be brief');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(body.max_tokens).toBe(256);
      expect(body.stream).toBe(false);
    });

    it('defaults max_tokens to 4096 when maxOutputTokens is absent', async () => {
      const adapter = new AnthropicAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }], stop_reason: 'end_turn' }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      await adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      );

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
    });

    it('extracts tool_use blocks into toolCalls and maps tool_use to tool_call', async () => {
      const adapter = new AnthropicAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          content: [
            { type: 'text', text: 'let me check' },
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Rome' } },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 3, output_tokens: 7 },
        }), { status: 200 }),
      ));

      const result = await adapter.complete(
        {
          messages: [{ role: 'user', content: 'weather?' }],
          tools: [{ name: 'get_weather', description: 'weather', parametersSchema: { type: 'object' } }],
        },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      );

      expect(result.content).toBe('let me check');
      expect(result.finishReason).toBe('tool_call');
      expect(result.toolCalls).toEqual([
        { id: 'toolu_1', name: 'get_weather', arguments: { city: 'Rome' } },
      ]);
    });

    it('maps tools into the Anthropic input_schema shape', async () => {
      const adapter = new AnthropicAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }], stop_reason: 'end_turn' }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      await adapter.complete(
        {
          messages: [{ role: 'user', content: 'hi' }],
          tools: [{ name: 'f', description: 'd', parametersSchema: { type: 'object' } }],
        },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      );

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual([
        { name: 'f', description: 'd', input_schema: { type: 'object' } },
      ]);
    });

    it.each([
      ['end_turn', 'stop'],
      ['stop_sequence', 'stop'],
      ['tool_use', 'tool_call'],
      ['max_tokens', 'length'],
      ['refusal', 'error'],
    ])('maps stop_reason %s to %s', async (stopReason, expected) => {
      const adapter = new AnthropicAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }], stop_reason: stopReason }), { status: 200 }),
      ));

      const result = await adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      );

      expect(result.finishReason).toBe(expected);
    });

    it('throws ProviderError when the API key is missing', async () => {
      const adapter = new AnthropicAdapter();

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'claude-sonnet-5' },
      )).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError on a non-2xx response', async () => {
      const adapter = new AnthropicAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      )).rejects.toThrow(ProviderError);
    });
  });

  describe('stream', () => {

    it('yields text from content_block_delta events', async () => {
      const adapter = new AnthropicAdapter();

      const body = sseStream([
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } }),
        JSON.stringify({ type: 'message_stop' }),
      ]);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

      const chunks: string[] = [];

      for await (const chunk of adapter.stream(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hel', 'lo']);
    });

    it('throws ProviderError on a non-2xx stream response', async () => {
      const adapter = new AnthropicAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

      const iterate = async () => {

        for await (const _chunk of adapter.stream(
          { messages: [{ role: 'user', content: 'hi' }] },
          { model: 'claude-sonnet-5', apiKey: 'sk-ant' },
        )) {
          // drain
        }
      };

      await expect(iterate()).rejects.toThrow(ProviderError);
    });
  });

  describe('ping', () => {

    it('succeeds when the messages endpoint responds 2xx', async () => {
      const adapter = new AnthropicAdapter();

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.ping({ model: 'claude-sonnet-5', apiKey: 'sk-ant' })).resolves.toBeUndefined();
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(1);
    });

    it('throws ProviderError when the API key is missing', async () => {
      const adapter = new AnthropicAdapter();

      await expect(adapter.ping({ model: 'claude-sonnet-5' })).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when the ping response is not ok', async () => {
      const adapter = new AnthropicAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

      await expect(adapter.ping({ model: 'claude-sonnet-5', apiKey: 'sk-ant' })).rejects.toThrow(ProviderError);
    });
  });
});
