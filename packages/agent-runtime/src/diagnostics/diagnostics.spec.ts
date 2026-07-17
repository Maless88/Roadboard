import type { LlmModelDescriptor } from '../capability/contract';
import { buildRegistry } from '../registry/provider-registry';
import { detectConfig } from '../registry/detection';

import { buildRuntimeDiagnostics } from './diagnostics';


const TOOL_VISION_MODEL: LlmModelDescriptor = {
  id: 'full-capability-model',
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
};


const NO_TOOL_NO_VISION_MODEL: LlmModelDescriptor = {
  id: 'basic-model',
  capabilities: {
    toolUse: false,
    structuredOutput: false,
    vision: false,
    streaming: true,
    longContext: false,
    contextWindowTokens: 8_192,
  },
  costClass: 'free',
  latencyClass: 'interactive',
};


describe('buildRuntimeDiagnostics', () => {

  it('never throws and reports offline-limited with no providers when nothing is configured', async () => {
    const env = {};
    const detected = detectConfig(env);
    const registry = await buildRegistry(env);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('offline-limited');
    expect(diagnostics.providers).toEqual([]);
    expect(diagnostics.degradedFeatures).toEqual([{ feature: 'llm-turns', reason: 'no provider configured' }]);
    expect(diagnostics.summary).toContain('offline-limited');
  });

  it('reports a single-provider report for a lone anthropic key', async () => {
    const env = { ANTHROPIC_API_KEY: 'sk-ant' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('single-provider');
    expect(diagnostics.providers).toHaveLength(1);
    expect(diagnostics.providers[0]).toMatchObject({
      id: 'anthropic',
      privacyClass: 'public-cloud',
      configured: true,
    });
    expect(diagnostics.providers[0].modelCount).toBe(diagnostics.providers[0].models.length);
    // Anthropic's static catalog declares no vision/tool-use gaps across all models — assert the
    // degraded set is derived, not fabricated, by checking the local-privacy gap only.
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'local-privacy')).toBe(true);
  });

  it('reports a multi-provider report combining anthropic and openai', async () => {
    const env = { ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('multi-provider');
    expect(diagnostics.providers.map((p) => p.id).sort()).toEqual(['anthropic', 'openai']);
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'local-privacy')).toBe(true);
    expect(diagnostics.summary).toContain('2 providers');
  });

  it('reports a local-only report for ollama with injected models declaring full capabilities', async () => {
    const env = { OLLAMA_BASE_URL: 'http://localhost:11434' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env, { listOllamaModels: () => [TOOL_VISION_MODEL] });

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('local-only');
    expect(diagnostics.providers).toHaveLength(1);
    expect(diagnostics.providers[0].id).toBe('ollama');
    expect(diagnostics.providers[0].privacyClass).toBe('local');
    // A local provider with vision + toolUse leaves no capability-based degradation at all.
    expect(diagnostics.degradedFeatures).toEqual([]);
  });

  it('reports vision/toolUse degradations when no configured model declares them', async () => {
    const env = { OLLAMA_BASE_URL: 'http://localhost:11434' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env, { listOllamaModels: () => [NO_TOOL_NO_VISION_MODEL] });

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.degradedFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'vision' }),
        expect.objectContaining({ feature: 'toolUse' }),
      ]),
    );
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'local-privacy')).toBe(false);
  });

  it('reports an enterprise report with a private-cloud provider and empty models by default', async () => {
    const env = { OPENAI_BASE_URL: 'https://llm.internal.example.com/v1' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('enterprise');
    expect(diagnostics.providers).toHaveLength(1);
    expect(diagnostics.providers[0]).toMatchObject({ id: 'enterprise', privacyClass: 'private-cloud', modelCount: 0 });
    // Zero models means the capability union is empty, so vision/toolUse/local-privacy gaps are
    // still derived "regardless of" the llm-turns degradation — none of them are fabricated, they
    // fall out of an empty model set the same way they would for any other empty capability union.
    expect(diagnostics.degradedFeatures).toEqual(
      expect.arrayContaining([
        {
          feature: 'llm-turns',
          reason:
            '1 provider configured but 0 models available → no LLM turns possible until a model list is available',
        },
        expect.objectContaining({ feature: 'vision' }),
        expect.objectContaining({ feature: 'toolUse' }),
        expect.objectContaining({ feature: 'local-privacy' }),
      ]),
    );
    expect(diagnostics.degradedFeatures).toHaveLength(4);
  });

  it('distinguishes configured-but-zero-models from offline-limited for the llm-turns reason', async () => {
    const offlineEnv = {};
    const offlineDetected = detectConfig(offlineEnv);
    const offlineRegistry = await buildRegistry(offlineEnv);
    const offlineDiagnostics = buildRuntimeDiagnostics(offlineRegistry, offlineDetected);

    const zeroModelsEnv = { OPENAI_BASE_URL: 'https://llm.internal.example.com/v1' };
    const zeroModelsDetected = detectConfig(zeroModelsEnv);
    const zeroModelsRegistry = await buildRegistry(zeroModelsEnv);
    const zeroModelsDiagnostics = buildRuntimeDiagnostics(zeroModelsRegistry, zeroModelsDetected);

    expect(offlineDiagnostics.degradedFeatures[0].reason).not.toBe(
      zeroModelsDiagnostics.degradedFeatures[0].reason,
    );
    expect(offlineDiagnostics.degradedFeatures[0].reason).toBe('no provider configured');
    expect(zeroModelsDiagnostics.degradedFeatures[0].reason).toContain('0 models available');
  });

  it('does not emit an llm-turns degradation when at least one model is available', async () => {
    const env = { OLLAMA_BASE_URL: 'http://localhost:11434' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env, { listOllamaModels: () => [TOOL_VISION_MODEL] });

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'llm-turns')).toBe(false);
  });
});
