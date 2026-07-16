import type { LlmModelDescriptor, PrivacyClass } from '../capability/contract';

import { classifyProfile, detectConfig } from './detection';
import { ANTHROPIC_MODEL_CATALOG, OPENAI_MODEL_CATALOG } from './model-catalog';
import type {
  BuiltRegistry,
  RegisteredProvider,
  RegistryDeps,
  RegistryEnvInput,
  RegistryProviderId,
} from './types';


/**
 * Privacy class per provider brand: ollama runs locally, openai/anthropic are branded
 * public-cloud APIs, and an enterprise/openai-compatible endpoint is treated as
 * `private-cloud` by default — it is operator-controlled infrastructure, not a public brand
 * endpoint, but it is not verified to be `local` either. Callers with stronger evidence about
 * a specific enterprise deployment can override this downstream.
 */
const PRIVACY_CLASS_BY_PROVIDER: Record<RegistryProviderId, PrivacyClass> = {
  ollama: 'local',
  openai: 'public-cloud',
  anthropic: 'public-cloud',
  enterprise: 'private-cloud',
};


/**
 * Enumerates the known model descriptors for a given provider. `openai`/`anthropic` use the
 * static in-module catalog. `ollama` model listing is injected (`deps.listOllamaModels`) since
 * the real set comes from a network call (`/api/tags`) that pure functions must never make.
 * `enterprise` has no reliable static catalog — a custom base URL can point at any deployment —
 * so it returns an empty list unless `deps.listEnterpriseModels` is supplied; the OpenAI catalog
 * is deliberately never reused here.
 */
export async function listModels(
  provider: RegistryProviderId,
  deps: RegistryDeps = {},
): Promise<readonly LlmModelDescriptor[]> {

  switch (provider) {

    case 'openai':
      return OPENAI_MODEL_CATALOG;

    case 'anthropic':
      return ANTHROPIC_MODEL_CATALOG;

    case 'ollama':
      return deps.listOllamaModels ? await deps.listOllamaModels() : [];

    case 'enterprise':
      return deps.listEnterpriseModels ? await deps.listEnterpriseModels() : [];

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown registry provider: ${String(_exhaustive)}`);
    }
  }
}


/**
 * Composes detection + listModels + capability normalization + profile classification into a
 * single metadata-only registry. Produces `RegisteredProvider[]` — descriptors only, never an
 * executable `LlmProvider` (no `complete`/`stream`/`ping`).
 */
export async function buildRegistry(
  env: RegistryEnvInput,
  deps: RegistryDeps = {},
): Promise<BuiltRegistry> {

  const detected = detectConfig(env);
  const profile = classifyProfile(detected);
  const providerIds: RegistryProviderId[] = [];

  if (detected.enterprise) providerIds.push('enterprise');
  if (detected.anthropic) providerIds.push('anthropic');

  // A custom `OPENAI_BASE_URL` means `OPENAI_API_KEY` (if present) belongs to the
  // enterprise/openai-compatible endpoint, not the branded public OpenAI API — registering
  // both would wrongly expose the OpenAI static catalog/public-cloud privacy class for a
  // deployment that may not even be OpenAI.
  if (detected.openai && !detected.enterprise) providerIds.push('openai');

  if (detected.ollama) providerIds.push('ollama');

  const providers: RegisteredProvider[] = await Promise.all(
    providerIds.map(async (id) => ({
      id,
      privacyClass: PRIVACY_CLASS_BY_PROVIDER[id],
      models: await listModels(id, deps),
    })),
  );

  return { profile, providers };
}
