import type { LlmModelDescriptor } from '../capability/contract';


/**
 * Static catalog of well-known models per brand provider. Enterprise/openai-compatible
 * providers have no reliable static catalog (the model set depends on the custom
 * deployment) so they are deliberately excluded here — see registry `listModels`.
 */
export const OPENAI_MODEL_CATALOG: readonly LlmModelDescriptor[] = [
  {
    id: 'gpt-4o',
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: true,
      streaming: true,
      longContext: true,
      contextWindowTokens: 128_000,
    },
    costClass: 'high',
    latencyClass: 'interactive',
  },
  {
    id: 'gpt-4o-mini',
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: true,
      streaming: true,
      longContext: true,
      contextWindowTokens: 128_000,
    },
    costClass: 'low',
    latencyClass: 'realtime',
  },
];


export const ANTHROPIC_MODEL_CATALOG: readonly LlmModelDescriptor[] = [
  {
    id: 'claude-opus-4-8',
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: true,
      streaming: true,
      longContext: true,
      contextWindowTokens: 200_000,
    },
    costClass: 'high',
    latencyClass: 'batch',
  },
  {
    id: 'claude-sonnet-5',
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: true,
      streaming: true,
      longContext: true,
      contextWindowTokens: 200_000,
    },
    costClass: 'medium',
    latencyClass: 'interactive',
  },
  {
    id: 'claude-haiku-4-5',
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: false,
      streaming: true,
      longContext: true,
      contextWindowTokens: 200_000,
    },
    costClass: 'low',
    latencyClass: 'realtime',
  },
];
