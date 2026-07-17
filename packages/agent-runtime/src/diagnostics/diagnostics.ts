import { buildRegistry } from '../registry/provider-registry';
import { detectConfig, readRegistryEnvFromProcess } from '../registry/detection';
import type { BuiltRegistry, DetectedConfig } from '../registry/types';

import type {
  DegradedFeature,
  DiagnosticsOptions,
  ProviderDiagnostics,
  ReadRuntimeDiagnosticsDeps,
  RuntimeDiagnostics,
} from './types';


function toProviderDiagnostics(registry: BuiltRegistry): ProviderDiagnostics[] {

  return registry.providers.map((provider) => ({
    id: provider.id,
    privacyClass: provider.privacyClass,
    modelCount: provider.models.length,
    models: provider.models.map((model) => ({
      id: model.id,
      capabilities: model.capabilities,
      costClass: model.costClass,
      latencyClass: model.latencyClass,
    })),
    configured: true,
  }));
}


function computeDegradedFeatures(registry: BuiltRegistry, providers: ProviderDiagnostics[]): DegradedFeature[] {
  const degraded: DegradedFeature[] = [];

  if (registry.profile === 'offline-limited') {
    degraded.push({ feature: 'llm-turns', reason: 'no provider configured' });
    return degraded;
  }

  const totalModels = providers.reduce((sum, provider) => sum + provider.modelCount, 0);

  if (totalModels === 0) {
    const providerCount = providers.length;
    const providerWord = providerCount === 1 ? 'provider' : 'providers';

    degraded.push({
      feature: 'llm-turns',
      reason: `${providerCount} ${providerWord} configured but 0 models available → no LLM turns possible until a model list is available`,
    });
  }

  const allModels = providers.flatMap((provider) => provider.models);
  const hasVision = allModels.some((model) => model.capabilities.vision);
  const hasToolUse = allModels.some((model) => model.capabilities.toolUse);
  const hasLocalProvider = providers.some((provider) => provider.privacyClass === 'local');

  if (!hasVision) {
    degraded.push({ feature: 'vision', reason: 'no provider declares `vision` → vision tasks unavailable' });
  }

  if (!hasToolUse) {
    degraded.push({ feature: 'toolUse', reason: 'no provider declares `toolUse` → tool-use tasks unavailable' });
  }

  if (!hasLocalProvider) {
    degraded.push({
      feature: 'local-privacy',
      reason: "no local provider → cannot satisfy `maxPrivacyClass: 'local'` tasks",
    });
  }

  return degraded;
}


function buildSummary(registry: BuiltRegistry, providers: ProviderDiagnostics[], degradedFeatures: DegradedFeature[]): string {
  const providerCount = providers.length;
  const modelCount = providers.reduce((sum, provider) => sum + provider.modelCount, 0);
  const degradedCount = degradedFeatures.length;
  const providerWord = providerCount === 1 ? 'provider' : 'providers';
  const modelWord = modelCount === 1 ? 'model' : 'models';
  const degradedWord = degradedCount === 1 ? 'feature' : 'features';

  return `${providerCount} ${providerWord}, ${modelCount} ${modelWord}, profile=${registry.profile}, ${degradedCount} degraded ${degradedWord}`;
}


/**
 * Pure composition of an already-built registry + detection into a structured diagnostics
 * report. Never reads `process.env` or performs network I/O — see
 * `readRuntimeDiagnosticsFromProcess` for the real-env boundary.
 */
export function buildRuntimeDiagnostics(
  registry: BuiltRegistry,
  detected: DetectedConfig,
  _opts: DiagnosticsOptions = {},
): RuntimeDiagnostics {

  void detected;

  const providers = toProviderDiagnostics(registry);
  const degradedFeatures = computeDegradedFeatures(registry, providers);
  const summary = buildSummary(registry, providers, degradedFeatures);

  return {
    profile: registry.profile,
    providers,
    degradedFeatures,
    summary,
  };
}


/**
 * Impure boundary: reads `process.env`, detects config, builds the registry, and composes the
 * diagnostics report — analogous to `readRegistryEnvFromProcess` for the registry layer.
 */
export async function readRuntimeDiagnosticsFromProcess(
  deps: ReadRuntimeDiagnosticsDeps = {},
): Promise<RuntimeDiagnostics> {
  const env = readRegistryEnvFromProcess();
  const detected = detectConfig(env);
  const registry = await buildRegistry(env, deps);

  return buildRuntimeDiagnostics(registry, detected, {});
}
