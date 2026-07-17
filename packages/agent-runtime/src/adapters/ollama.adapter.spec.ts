import { ProviderError } from '../providers/types';

import { OllamaAdapter } from './ollama.adapter';


function ndjsonStream(lines: string[]): ReadableStream<Uint8Array> {

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {

      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }

      controller.close();
    },
  });
}


describe('OllamaAdapter', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to an empty model catalog when none is injected', () => {
    const adapter = new OllamaAdapter();

    expect(adapter.models).toEqual([]);
    expect(adapter.privacyClass).toBe('local');
    expect(adapter.id).toBe('ollama');
  });

  describe('complete', () => {

    it('calls /api/chat with stream:false and maps the response', async () => {
      const adapter = new OllamaAdapter();

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          message: { content: 'hello' },
          prompt_eval_count: 12,
          eval_count: 4,
          done: true,
        }), { status: 200 }),
      );

      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'llama3.2', baseUrl: 'http://localhost:11434' },
      );

      expect(result).toEqual({
        content: 'hello',
        usage: { inputTokens: 12, outputTokens: 4 },
        finishReason: 'stop',
      });

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe('http://localhost:11434/api/chat');
      expect(JSON.parse(init.body).stream).toBe(false);
    });

    it('throws ProviderError when baseUrl is missing', async () => {
      const adapter = new OllamaAdapter();

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'llama3.2' },
      )).rejects.toThrow(ProviderError);
    });

    it('throws ProviderError on a non-2xx response', async () => {
      const adapter = new OllamaAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

      await expect(adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'llama3.2', baseUrl: 'http://localhost:11434' },
      )).rejects.toThrow(ProviderError);
    });
  });

  describe('stream', () => {

    it('reuses parseNdjsonDeltas to yield content chunks', async () => {
      const adapter = new OllamaAdapter();

      const body = ndjsonStream([
        JSON.stringify({ message: { content: 'Hel' } }),
        JSON.stringify({ message: { content: 'lo' } }),
        JSON.stringify({ done: true }),
      ]);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

      const chunks: string[] = [];

      for await (const chunk of adapter.stream(
        { messages: [{ role: 'user', content: 'hi' }] },
        { model: 'llama3.2', baseUrl: 'http://localhost:11434' },
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hel', 'lo']);
    });
  });

  describe('ping', () => {

    it('succeeds when GET /api/tags responds 2xx', async () => {
      const adapter = new OllamaAdapter();

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.ping({ model: 'llama3.2', baseUrl: 'http://localhost:11434' })).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('throws ProviderError when the ping response is not ok', async () => {
      const adapter = new OllamaAdapter();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

      await expect(adapter.ping({ model: 'llama3.2', baseUrl: 'http://localhost:11434' })).rejects.toThrow(ProviderError);
    });
  });
});
