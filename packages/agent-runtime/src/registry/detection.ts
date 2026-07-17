import { optionalEnv } from '@roadboard/config';

import type { DetectedConfig, RegistryEnvInput, RuntimeProfile } from './types';


/**
 * Pure detection: derives which providers are configured from an injected env snapshot.
 * Never reads `process.env` directly — see `readRegistryEnvFromProcess` for the real boundary.
 */
export function detectConfig(env: RegistryEnvInput): DetectedConfig {
  const enterpriseBaseUrl = env.OPENAI_BASE_URL?.trim() || undefined;

  return {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    ollama: Boolean(env.OLLAMA_BASE_URL),
    gemini: Boolean(env.GEMINI_API_KEY),
    enterprise: enterpriseBaseUrl !== undefined,
    enterpriseBaseUrl,
    enterpriseApiKey: env.OPENAI_API_KEY,
  };
}


/**
 * Precedence: enterprise (custom `OPENAI_BASE_URL`) always wins, since a custom
 * openai-compatible endpoint changes the operational/privacy model regardless of which
 * other providers are also configured. Otherwise the count of detected brand/local
 * providers decides local-only / single-provider / multi-provider / offline-limited.
 */
export function classifyProfile(detected: DetectedConfig): RuntimeProfile {

  if (detected.enterprise) {
    return 'enterprise';
  }

  const detectedCount = [detected.anthropic, detected.openai, detected.ollama, detected.gemini].filter(Boolean).length;

  if (detectedCount === 0) {
    return 'offline-limited';
  }

  if (detectedCount >= 2) {
    return 'multi-provider';
  }

  if (detected.ollama) {
    return 'local-only';
  }

  return 'single-provider';
}


/**
 * Real boundary: reads `process.env` and normalizes it into the injectable `RegistryEnvInput`
 * shape. `optionalEnv` is used only here, never inside pure detection/profile functions.
 *
 * Detection must reflect whether the operator explicitly configured `OLLAMA_BASE_URL`, so the
 * fallback here is an empty string (falsy, i.e. "not configured") rather than the
 * `http://localhost:11434` runtime default used by `agent-executor.ts` when actually dialing
 * Ollama. The two defaults serve different purposes and are intentionally not the same value.
 */
export function readRegistryEnvFromProcess(): RegistryEnvInput {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OLLAMA_BASE_URL: optionalEnv('OLLAMA_BASE_URL', '') || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
}
