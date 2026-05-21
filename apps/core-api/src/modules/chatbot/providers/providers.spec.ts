import { describe, it, expect, vi, afterEach } from 'vitest';

import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import { getProvider, DEFAULT_MODELS } from './index';


function streamResponse(lines: string[]): Response {

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {

      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }

      controller.close();
    },
  });

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}


async function collect(iter: AsyncIterable<string>): Promise<string[]> {

  const out: string[] = [];

  for await (const chunk of iter) {
    out.push(chunk);
  }

  return out;
}


afterEach(() => {

  vi.restoreAllMocks();
});


describe('getProvider factory', () => {

  it('returns the correct implementation for each name', () => {

    expect(getProvider('openai')).toBeInstanceOf(OpenAIProvider);
    expect(getProvider('anthropic')).toBeInstanceOf(AnthropicProvider);
    expect(getProvider('ollama')).toBeInstanceOf(OllamaProvider);
  });


  it('exposes sensible defaults per provider', () => {

    expect(DEFAULT_MODELS.openai).toMatch(/gpt/i);
    expect(DEFAULT_MODELS.anthropic).toMatch(/claude/i);
    expect(DEFAULT_MODELS.ollama.length).toBeGreaterThan(0);
  });
});


describe('OpenAIProvider.stream', () => {

  it('parses SSE deltas and yields concatenated tokens', async () => {

    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      'data: [DONE]\n',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(streamResponse(sse));

    const provider = new OpenAIProvider();
    const out = await collect(provider.stream(
      [{ role: 'user', content: 'hi' }],
      { apiKey: 'sk-test', model: 'gpt-4o-mini' },
    ));

    expect(out.join('')).toBe('Hello world');
  });


  it('throws ProviderError when API key is missing', async () => {

    const provider = new OpenAIProvider();
    const iter = provider.stream([{ role: 'user', content: 'x' }], { model: 'gpt-4o-mini' });

    await expect(collect(iter)).rejects.toThrow(/API key/);
  });
});


describe('AnthropicProvider.stream', () => {

  it('extracts content_block_delta text events', async () => {

    const sse = [
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n',
      '\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n',
      '\n',
      'data: {"type":"message_stop"}\n',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(streamResponse(sse));

    const provider = new AnthropicProvider();
    const out = await collect(provider.stream(
      [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }],
      { apiKey: 'k', model: 'claude-sonnet-4-5-20250929' },
    ));

    expect(out.join('')).toBe('Hi there');
  });
});


describe('OllamaProvider.stream', () => {

  it('parses NDJSON chat stream', async () => {

    const ndjson = [
      JSON.stringify({ message: { content: 'foo' }, done: false }) + '\n',
      JSON.stringify({ message: { content: 'bar' }, done: false }) + '\n',
      JSON.stringify({ done: true }) + '\n',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new ReadableStream<Uint8Array>({
        start(c) {

          const enc = new TextEncoder();

          for (const l of ndjson) c.enqueue(enc.encode(l));

          c.close();
        },
      }), { status: 200 }),
    );

    const provider = new OllamaProvider();
    const out = await collect(provider.stream(
      [{ role: 'user', content: 'hi' }],
      { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    ));

    expect(out.join('')).toBe('foobar');
  });


  it('throws when baseUrl missing', async () => {

    const provider = new OllamaProvider();
    const iter = provider.stream([{ role: 'user', content: 'x' }], { model: 'llama3.2' });

    await expect(collect(iter)).rejects.toThrow(/baseUrl/);
  });
});
