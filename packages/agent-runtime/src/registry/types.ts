import type { LlmModelDescriptor, PrivacyClass } from '../capability/contract';
import type { ProviderName } from '../providers';


/** Identifier for every provider the registry can detect, including the enterprise slot. */
export type RegistryProviderId = ProviderName | 'enterprise' | 'gemini';


/**
 * Runtime shape produced by detecting configured providers, in exact precedence order.
 * `local-only`: only ollama detected.
 * `single-provider`: exactly one cloud brand provider (openai or anthropic) detected, no enterprise.
 * `multi-provider`: two or more brand/local providers detected, no enterprise.
 * `enterprise`: `OPENAI_BASE_URL` present and non-empty — takes precedence over every other
 * combination, since a custom openai-compatible endpoint changes the operational model
 * regardless of which other providers are also configured.
 * `offline-limited`: no provider detected at all.
 */
export type RuntimeProfile =
  | 'local-only'
  | 'single-provider'
  | 'multi-provider'
  | 'enterprise'
  | 'offline-limited';


export interface RegisteredProvider {
  readonly id: RegistryProviderId;
  readonly privacyClass: PrivacyClass;
  readonly models: readonly LlmModelDescriptor[];
}


/** Env surface consumed by pure detection functions — never read from `process.env` directly. */
export interface RegistryEnvInput {
  readonly ANTHROPIC_API_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_BASE_URL?: string;
  readonly OLLAMA_BASE_URL?: string;
  readonly GEMINI_API_KEY?: string;
}


export interface DetectedConfig {
  readonly anthropic: boolean;
  readonly openai: boolean;
  readonly ollama: boolean;
  readonly gemini: boolean;
  readonly enterprise: boolean;
  readonly enterpriseBaseUrl?: string;
  readonly enterpriseApiKey?: string;
}


/** Injectable dependencies so pure registry logic never opens a socket. */
export interface RegistryDeps {
  listOllamaModels?: () => Promise<readonly LlmModelDescriptor[]> | readonly LlmModelDescriptor[];
  listEnterpriseModels?: () => Promise<readonly LlmModelDescriptor[]> | readonly LlmModelDescriptor[];
  listGeminiModels?: () => Promise<readonly LlmModelDescriptor[]> | readonly LlmModelDescriptor[];
}


export interface BuiltRegistry {
  readonly profile: RuntimeProfile;
  readonly providers: readonly RegisteredProvider[];
}
