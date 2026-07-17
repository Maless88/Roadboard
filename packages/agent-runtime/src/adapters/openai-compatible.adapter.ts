import type { LlmModelDescriptor, LlmProvider, LlmRequest, LlmResponse, LlmToolCall, PrivacyClass } from '../capability/contract';
import type { ChatProviderConfig } from '../providers/types';
import { ProviderError } from '../providers/types';
import { parseSseDeltas } from '../providers/openai.provider';
import { OPENAI_MODEL_CATALOG } from '../registry/model-catalog';


const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';


export interface OpenAiCompatibleProviderOptions {
  id: string;
  privacyClass: PrivacyClass;
  baseUrl?: string;
  models?: readonly LlmModelDescriptor[];
}


interface OpenAiChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}


interface OpenAiToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}


interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string; tool_calls?: OpenAiToolCall[] };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}


function mapToolCalls(toolCalls: OpenAiToolCall[] | undefined): LlmToolCall[] | undefined {

  if (!toolCalls?.length) return undefined;

  return toolCalls.map((call) => {

    const rawArguments = call.function?.arguments ?? '';

    let parsedArguments: unknown = rawArguments;

    try {
      parsedArguments = JSON.parse(rawArguments);
    } catch {

      // Malformed tool-call arguments: pass the raw string through rather than throwing.
      parsedArguments = rawArguments;
    }

    return {
      id: call.id ?? '',
      name: call.function?.name ?? '',
      arguments: parsedArguments,
    };
  });
}


function mapFinishReason(reason: string | undefined): LlmResponse['finishReason'] {

  switch (reason) {

    case 'stop':
      return 'stop';

    case 'tool_calls':
      return 'tool_call';

    case 'length':
      return 'length';

    default:
      return 'error';
  }
}


function mapTools(tools: LlmRequest['tools']): unknown[] {

  return (tools ?? []).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersSchema,
    },
  }));
}


export class OpenAiCompatibleProvider implements LlmProvider {

  readonly id: string;
  readonly privacyClass: PrivacyClass;
  readonly models: readonly LlmModelDescriptor[];
  private readonly baseUrl: string;
  private readonly isBrandedOpenAi: boolean;


  constructor(options: OpenAiCompatibleProviderOptions) {
    this.id = options.id;
    this.privacyClass = options.privacyClass;
    this.isBrandedOpenAi = !options.baseUrl;
    this.baseUrl = (options.baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
    this.models = options.models ?? (this.isBrandedOpenAi ? OPENAI_MODEL_CATALOG : []);
  }


  private requireApiKey(config: ChatProviderConfig): string | undefined {

    if (this.isBrandedOpenAi && !config.apiKey) {
      throw new ProviderError('OpenAI provider requires an API key');
    }

    return config.apiKey;
  }


  private buildHeaders(apiKey: string | undefined): Record<string, string> {

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    return headers;
  }


  async complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: false,
        ...(request.tools ? { tools: mapTools(request.tools) } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`OpenAI error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as OpenAiChatCompletionResponse;
    const choice = data.choices?.[0];
    const toolCalls = mapToolCalls(choice?.message?.tool_calls);

    return {
      content: choice?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      finishReason: mapFinishReason(choice?.finish_reason),
      ...(toolCalls ? { toolCalls } : {}),
    };
  }


  async *stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(apiKey),
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`OpenAI error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    yield* parseSseDeltas(res.body, (chunk: OpenAiChatCompletionChunk) => chunk.choices?.[0]?.delta?.content);
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: this.buildHeaders(apiKey),
    });

    if (!res.ok) {
      throw new ProviderError(`OpenAI ping failed: ${res.status}`, res.status);
    }
  }
}
