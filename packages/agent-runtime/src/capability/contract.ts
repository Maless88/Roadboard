import type { ChatMessage, ChatProviderConfig } from '../providers/types';

/**
 * Type-only, erasable capability contract for the LLM runtime.
 * See docs/adr/0002-llm-runtime-capability-contract.md for the full rationale.
 * No enum, class, const, or runtime import is permitted in this file.
 */

export type AgentRole =
  | 'intake'
  | 'router'
  | 'dev'
  | 'security'
  | 'researcher'
  | 'assistant';

/** Canonical order: local < private-cloud < public-cloud. */
export type PrivacyClass = 'local' | 'private-cloud' | 'public-cloud';

/** Canonical order: free < low < medium < high. */
export type CostClass = 'free' | 'low' | 'medium' | 'high';

/** Canonical order: realtime < interactive < batch. */
export type LatencyClass = 'realtime' | 'interactive' | 'batch';

/** What to do when TaskRequirements exceed every available provider's capabilities. */
export type DegradePolicy = 'degrade' | 'ask' | 'skip' | 'fail';


export interface LlmCapabilities {
  toolUse: boolean;
  structuredOutput: boolean;
  vision: boolean;
  streaming: boolean;
  longContext: boolean;
  contextWindowTokens: number;
}


export interface LlmModelDescriptor {
  id: string;
  capabilities: LlmCapabilities;
  costClass: CostClass;
  latencyClass: LatencyClass;
}


export interface LlmProvider {
  readonly id: string;
  readonly privacyClass: PrivacyClass;
  readonly models: readonly LlmModelDescriptor[];

  complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse>;

  stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string>;

  ping(config: ChatProviderConfig): Promise<void>;
}


export interface LlmToolDefinition {
  name: string;
  description: string;
  parametersSchema: unknown;
}


export interface LlmRequest {
  messages: ChatMessage[];
  tools?: readonly LlmToolDefinition[];
  maxOutputTokens?: number;
}


export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}


export interface LlmToolCall {
  id: string;
  name: string;
  arguments: unknown;
}


export interface LlmResponse {
  content: string;
  usage: LlmUsage;
  finishReason: 'stop' | 'tool_call' | 'length' | 'error';
  toolCalls?: readonly LlmToolCall[];
}


export interface TaskRequirements {
  role: AgentRole;
  requiredCapabilities: readonly (keyof LlmCapabilities)[];
  maxPrivacyClass: PrivacyClass;
  maxCostClass: CostClass;
  maxLatencyClass: LatencyClass;
  maxPremiumCalls?: number;
  maxToolCalls?: number;
  maxFilesTouched?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}
