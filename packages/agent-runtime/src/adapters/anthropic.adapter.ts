import type { LlmModelDescriptor, LlmProvider, LlmRequest, LlmResponse, LlmToolCall, PrivacyClass } from '../capability/contract';
import type { ChatProviderConfig } from '../providers/types';
import { ProviderError } from '../providers/types';
import { parseSseDeltas } from '../providers/openai.provider';
import { pickAnthropicTextDelta } from '../providers/anthropic.provider';
import { ANTHROPIC_MODEL_CATALOG } from '../registry/model-catalog';


const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;


export interface AnthropicAdapterOptions {
  models?: readonly LlmModelDescriptor[];
}


interface AnthropicTextBlock {
  type: 'text';
  text?: string;
}


interface AnthropicToolUseBlock {
  type: 'tool_use';
  id?: string;
  name?: string;
  input?: unknown;
}


type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string };


interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}


function mapFinishReason(reason: string | undefined): LlmResponse['finishReason'] {

  switch (reason) {

    case 'end_turn':
    case 'stop_sequence':
      return 'stop';

    case 'tool_use':
      return 'tool_call';

    case 'max_tokens':
      return 'length';

    default:
      return 'error';
  }
}


function mapTools(tools: LlmRequest['tools']): unknown[] {

  return (tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parametersSchema,
  }));
}


function extractText(content: AnthropicContentBlock[] | undefined): string {

  return (content ?? [])
    .filter((block): block is AnthropicTextBlock => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}


function extractToolCalls(content: AnthropicContentBlock[] | undefined): LlmToolCall[] | undefined {

  const toolCalls = (content ?? [])
    .filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use')
    .map((block) => ({
      id: block.id ?? '',
      name: block.name ?? '',
      arguments: block.input,
    }));

  return toolCalls.length ? toolCalls : undefined;
}


export class AnthropicAdapter implements LlmProvider {

  readonly id = 'anthropic' as const;
  readonly privacyClass: PrivacyClass = 'public-cloud';
  readonly models: readonly LlmModelDescriptor[];


  constructor(options: AnthropicAdapterOptions = {}) {
    this.models = options.models ?? ANTHROPIC_MODEL_CATALOG;
  }


  private requireApiKey(config: ChatProviderConfig): string {

    if (!config.apiKey) {
      throw new ProviderError('Anthropic provider requires an API key');
    }

    return config.apiKey;
  }


  private buildHeaders(apiKey: string): Record<string, string> {

    return {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    };
  }


  private extractSystem(request: LlmRequest): string | undefined {

    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    return system || undefined;
  }


  private toTurnMessages(request: LlmRequest): Array<{ role: string; content: string }> {

    return request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
  }


  async complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify({
        model: config.model,
        system: this.extractSystem(request),
        messages: this.toTurnMessages(request),
        max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        stream: false,
        ...(request.tools ? { tools: mapTools(request.tools) } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Anthropic error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as AnthropicMessagesResponse;
    const toolCalls = extractToolCalls(data.content);

    return {
      content: extractText(data.content),
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      finishReason: mapFinishReason(data.stop_reason),
      ...(toolCalls ? { toolCalls } : {}),
    };
  }


  async *stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify({
        model: config.model,
        system: this.extractSystem(request),
        messages: this.toTurnMessages(request),
        max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
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

    const apiKey = this.requireApiKey(config);

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
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
