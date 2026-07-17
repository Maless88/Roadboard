import { ProviderError } from '../providers/types';
import { OPENAI_MODEL_CATALOG } from '../registry/model-catalog';

import { OpenAiCompatibleProvider } from './openai-compatible.adapter';


function sseStream(chunks: string[]): ReadableStream<Uint8Array> {

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}


describe('OpenAiCompatibleProvider', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('construction', () => {

    it('defaults to the branded OpenAI model catalog when no baseUrl override is given', () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      expect(provider.models).toBe(OPENAI_MODEL_CATALOG);
    });

    it('defaults to an empty catalog for a custom baseUrl', () => {
      const provider = new OpenAiCompatibleProvider({
        id: 'enterprise',
        privacyClass: 'private-cloud',
        baseUrl: 'https://llm.internal.example.com/v1',
      });

      expect(provider.models).toEqual([]);
    });
  });

  describe('complete', () => {

    it('calls chat/completions with stream:false and maps the response', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      const result = await provider.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gpt-4o-mini', apiKey: 'sk-test' },
      );

      expect(result).toEqual({
        content: 'hello',
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(JSON.parse(init.body).stream).toBe(false);
    });

    it.each([
      ['stop', 'stop'],
      ['tool_calls', 'tool_call'],
      ['length', 'length'],
      ['content_filter', 'error'],
    ])('maps finish_reason %s to %s', async (apiReason, expected) => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          choices: [{ message: { content: 'x' }, finish_reason: apiReason }],
        }), { status: 200 }),
      ));

      const result = await provider.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gpt-4o-mini', apiKey: 'sk-test' },
      );

      expect(result.finishReason).toBe(expected);
    });

    it('throws ProviderError when no API key is configured for the branded endpoint', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      await expect(provider.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gpt-4o-mini' },
      )).rejects.toThrow(ProviderError);
    });

    it('does not require an API key for a custom baseUrl', async () => {
      const provider = new OpenAiCompatibleProvider({
        id: 'enterprise',
        privacyClass: 'private-cloud',
        baseUrl: 'https://llm.internal.example.com/v1',
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] }), { status: 200 }),
      ));

      await expect(provider.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'custom-model' },
      )).resolves.toMatchObject({ content: 'hi' });
    });

    it('throws ProviderError on a non-2xx response', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })));

      await expect(provider.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gpt-4o-mini', apiKey: 'sk-test' },
      )).rejects.toThrow(ProviderError);
    });
  });

  describe('stream', () => {

    it('reuses parseSseDeltas to yield content chunks', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      const body = sseStream([
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
      ]);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

      const chunks: string[] = [];

      for await (const chunk of provider.stream(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'gpt-4o-mini', apiKey: 'sk-test' },
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hel', 'lo']);
    });
  });

  describe('ping', () => {

    it('succeeds when GET /models responds 2xx', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(provider.ping({ model: 'gpt-4o-mini', apiKey: 'sk-test' })).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ method: 'GET' }));
    });

    it('throws ProviderError when the ping response is not ok', async () => {
      const provider = new OpenAiCompatibleProvider({ id: 'openai', privacyClass: 'public-cloud' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

      await expect(provider.ping({ model: 'gpt-4o-mini', apiKey: 'sk-test' })).rejects.toThrow(ProviderError);
    });
  });
});
