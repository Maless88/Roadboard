import { ProviderError } from '../providers/types';

import { GeminiAdapter } from './gemini.adapter';


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


describe('GeminiAdapter', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to an empty model catalog and is public-cloud', () => {
    const adapter = new GeminiAdapter();

    expect(adapter.models).toEqual([]);
    expect(adapter.privacyClass).toBe('public-cloud');
    expect(adapter.id).toBe('gemini');
  });

  describe('complete', () => {

    it('maps roles/systemInstruction, extracts text/usage and maps STOP to stop', async () => {
      const adapter = new GeminiAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.complete(
        {
          messages: [
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'prior' },
          ],
        },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      );

      expect(result).toEqual({
        content: 'hello',
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });

      const [url, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);

      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=gm-test');
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'be brief' }] });
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'prior' }] },
      ]);
    });

    it('extracts functionCall parts into synthetic-id toolCalls and maps to tool_call', async () => {
      const adapter = new GeminiAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{
            content: { parts: [{ functionCall: { name: 'get_weather', args: { city: 'Rome' } } }] },
            finishReason: 'STOP',
          }],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 },
        }), { status: 200 }),
      ));

      const result = await adapter.complete(
        {
          messages: [{ role: 'user', content: 'weather?' }],
          tools: [{ name: 'get_weather', description: 'weather', parametersSchema: { type: 'object' } }],
        },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      );

      expect(result.finishReason).toBe('tool_call');
      expect(result.toolCalls).toEqual([
        { id: 'get_weather-0', name: 'get_weather', arguments: { city: 'Rome' } },
      ]);
    });

    it('maps tools into the Gemini functionDeclarations shape', async () => {
      const adapter = new GeminiAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }] }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      await adapter.complete(
        {
          messages: [{ role: 'user', content: 'hi' }],
          tools: [{ name: 'f', description: 'd', parametersSchema: { type: 'object' } }],
        },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      );

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual([
        { functionDeclarations: [{ name: 'f', description: 'd', parameters: { type: 'object' } }] },
      ]);
    });

    it.each([
      ['STOP', 'stop'],
      ['MAX_TOKENS', 'length'],
      ['SAFETY', 'error'],
    ])('maps finishReason %s to %s', async (finishReason, expected) => {
      const adapter = new GeminiAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason }] }), { status: 200 }),
      ));

      const result = await adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      );

      expect(result.finishReason).toBe(expected);
    });

    it('throws ProviderError when the API key is missing', async () => {
      const adapter = new GeminiAdapter();

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gemini-2.0-flash' },
      )).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError on a non-2xx response', async () => {
      const adapter = new GeminiAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      )).rejects.toThrow(ProviderError);
    });
  });

  describe('stream', () => {

    it('yields text from :streamGenerateContent SSE chunks', async () => {
      const adapter = new GeminiAdapter();

      const body = sseStream([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] }),
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'lo' }] } }] }),
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));

      vi.stubGlobal('fetch', fetchMock);

      const chunks: string[] = [];

      for await (const chunk of adapter.stream(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hel', 'lo']);
      expect(fetchMock.mock.calls[0][0]).toContain(':streamGenerateContent?alt=sse&key=gm-test');
    });

    it('throws ProviderError on a non-2xx stream response', async () => {
      const adapter = new GeminiAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

      const iterate = async () => {

        for await (const _chunk of adapter.stream(
          { messages: [{ role: 'user', content: 'hi' }] },
          { model: 'gemini-2.0-flash', apiKey: 'gm-test' },
        )) {
          // drain
        }
      };

      await expect(iterate()).rejects.toThrow(ProviderError);
    });
  });

  describe('ping', () => {

    it('succeeds when GET /models responds 2xx', async () => {
      const adapter = new GeminiAdapter();

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.ping({ model: 'gemini-2.0-flash', apiKey: 'gm-test' })).resolves.toBeUndefined();
      expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models?key=gm-test');
    });

    it('throws ProviderError when the API key is missing', async () => {
      const adapter = new GeminiAdapter();

      await expect(adapter.ping({ model: 'gemini-2.0-flash' })).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError when the ping response is not ok', async () => {
      const adapter = new GeminiAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

      await expect(adapter.ping({ model: 'gemini-2.0-flash', apiKey: 'gm-test' })).rejects.toThrow(ProviderError);
    });
  });
});
