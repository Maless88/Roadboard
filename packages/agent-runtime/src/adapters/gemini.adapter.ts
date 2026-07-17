import type { LlmModelDescriptor, LlmProvider, LlmRequest, LlmResponse, LlmToolCall, PrivacyClass } from '../capability/contract';
import type { ChatMessage, ChatProviderConfig } from '../providers/types';
import { ProviderError } from '../providers/types';
import { parseSseDeltas } from '../providers/openai.provider';


const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';


export interface GeminiAdapterOptions {
  // No static Gemini model catalog exists in this codebase; models are injectable and default
  // to empty rather than fabricating context-window sizes / capability flags. A curated catalog
  // is explicit follow-up work.
  models?: readonly LlmModelDescriptor[];
}


interface GeminiFunctionCall {
  name?: string;
  args?: unknown;
}


interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
}


interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}


interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}


function mapFinishReason(candidate: GeminiCandidate | undefined): LlmResponse['finishReason'] {

  const hasFunctionCall = (candidate?.content?.parts ?? []).some((part) => part.functionCall);

  if (hasFunctionCall) {
    return 'tool_call';
  }

  switch (candidate?.finishReason) {

    case 'STOP':
      return 'stop';

    case 'MAX_TOKENS':
      return 'length';

    default:
      return 'error';
  }
}


function mapTools(tools: LlmRequest['tools']): unknown[] | undefined {

  if (!tools?.length) return undefined;

  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersSchema,
    })),
  }];
}


function toGeminiRole(role: ChatMessage['role']): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}


function buildContents(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {

  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: toGeminiRole(m.role), parts: [{ text: m.content }] }));
}


function buildSystemInstruction(messages: ChatMessage[]): { parts: Array<{ text: string }> } | undefined {

  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  return system ? { parts: [{ text: system }] } : undefined;
}


function extractText(candidate: GeminiCandidate | undefined): string {

  return (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('');
}


function extractToolCalls(candidate: GeminiCandidate | undefined): LlmToolCall[] | undefined {

  const toolCalls = (candidate?.content?.parts ?? [])
    .map((part, index) => ({ part, index }))
    .filter((entry): entry is { part: GeminiPart & { functionCall: GeminiFunctionCall }; index: number } =>
      Boolean(entry.part.functionCall))
    .map(({ part, index }) => ({
      // Gemini does not return a tool-call id; synthesize a stable one from name + index.
      id: `${part.functionCall.name ?? 'tool'}-${index}`,
      name: part.functionCall.name ?? '',
      arguments: part.functionCall.args,
    }));

  return toolCalls.length ? toolCalls : undefined;
}


export class GeminiAdapter implements LlmProvider {

  readonly id = 'gemini' as const;
  readonly privacyClass: PrivacyClass = 'public-cloud';
  readonly models: readonly LlmModelDescriptor[];


  constructor(options: GeminiAdapterOptions = {}) {
    this.models = options.models ?? [];
  }


  private requireApiKey(config: ChatProviderConfig): string {

    if (!config.apiKey) {
      throw new ProviderError('Gemini provider requires an API key');
    }

    return config.apiKey;
  }


  private buildBody(request: LlmRequest): string {

    const tools = mapTools(request.tools);
    const systemInstruction = buildSystemInstruction(request.messages);

    return JSON.stringify({
      contents: buildContents(request.messages),
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(request.maxOutputTokens ? { generationConfig: { maxOutputTokens: request.maxOutputTokens } } : {}),
      ...(tools ? { tools } : {}),
    });
  }


  async complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.buildBody(request),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Gemini error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as GeminiGenerateContentResponse;
    const candidate = data.candidates?.[0];
    const toolCalls = extractToolCalls(candidate);

    return {
      content: extractText(candidate),
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      finishReason: mapFinishReason(candidate),
      ...(toolCalls ? { toolCalls } : {}),
    };
  }


  async *stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string> {

    const apiKey = this.requireApiKey(config);

    // `?alt=sse` makes :streamGenerateContent emit an SSE `data:` stream instead of an
    // incrementally-streamed JSON array, so the shared parseSseDeltas helper can be reused
    // rather than hand-rolling JSON-array parsing over a raw fetch body.
    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${config.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.buildBody(request),
      },
    );

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Gemini error ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    yield* parseSseDeltas(
      res.body,
      (chunk: GeminiGenerateContentResponse) => extractText(chunk.candidates?.[0]) || undefined,
    );
  }


  async ping(config: ChatProviderConfig): Promise<void> {

    const apiKey = this.requireApiKey(config);

    const res = await fetch(`${GEMINI_BASE_URL}/models?key=${apiKey}`, { method: 'GET' });

    if (!res.ok) {
      throw new ProviderError(`Gemini ping failed: ${res.status}`, res.status);
    }
  }
}
