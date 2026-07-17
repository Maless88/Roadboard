import type { LlmModelDescriptor, TaskRequirements } from '../capability/contract';
import { buildRuntimeDiagnostics } from '../diagnostics/diagnostics';
import { CapabilityRouter } from '../router/capability-router';
import { RouterError } from '../router/types';

import { classifyProfile, detectConfig } from './detection';
import { buildRegistry } from './provider-registry';
import type { RegistryEnvInput } from './types';


const NO_TOOL_USE_MODEL: LlmModelDescriptor = {
  id: 'no-tool-use-model',
  capabilities: {
    toolUse: false,
    structuredOutput: true,
    vision: false,
    streaming: true,
    longContext: false,
    contextWindowTokens: 8_192,
  },
  costClass: 'free',
  latencyClass: 'interactive',
};


function baseRequirements(overrides: Partial<TaskRequirements> = {}): TaskRequirements {
  return {
    role: 'dev',
    requiredCapabilities: [],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'high',
    maxLatencyClass: 'batch',
    ...overrides,
  };
}


describe('runtime matrix — only Ollama', () => {

  it('classifies as local-only and registers only ollama', async () => {
    const env: RegistryEnvInput = { OLLAMA_BASE_URL: 'http://localhost:11434' };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('local-only');

    const registry = await buildRegistry(env, { listOllamaModels: () => [NO_TOOL_USE_MODEL] });

    expect(registry.providers.map((p) => p.id)).toEqual(['ollama']);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('local-only');
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'toolUse')).toBe(true);
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'vision')).toBe(true);
  });
});


describe('runtime matrix — only OpenAI', () => {

  it('classifies as single-provider and registers only openai', async () => {
    const env: RegistryEnvInput = { OPENAI_API_KEY: 'sk-oai' };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('single-provider');

    const registry = await buildRegistry(env);

    expect(registry.providers.map((p) => p.id)).toEqual(['openai']);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('single-provider');
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'local-privacy')).toBe(true);
  });
});


describe('runtime matrix — only Anthropic', () => {

  it('classifies as single-provider and registers only anthropic', async () => {
    const env: RegistryEnvInput = { ANTHROPIC_API_KEY: 'sk-ant' };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('single-provider');

    const registry = await buildRegistry(env);

    expect(registry.providers.map((p) => p.id)).toEqual(['anthropic']);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('single-provider');
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'local-privacy')).toBe(true);
  });
});


describe('runtime matrix — only Gemini', () => {

  it('classifies as single-provider and registers only gemini, with 0-model degradation by default', async () => {
    const env: RegistryEnvInput = { GEMINI_API_KEY: 'gm-key' };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('single-provider');

    const registry = await buildRegistry(env);

    expect(registry.providers.map((p) => p.id)).toEqual(['gemini']);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('single-provider');
    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'llm-turns' && d.reason.includes('0 models available'))).toBe(true);
  });

  it('has no llm-turns degradation when an injected model list is available', async () => {
    const env: RegistryEnvInput = { GEMINI_API_KEY: 'gm-key' };
    const detected = detectConfig(env);
    const registry = await buildRegistry(env, { listGeminiModels: () => [NO_TOOL_USE_MODEL] });

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.degradedFeatures.some((d) => d.feature === 'llm-turns')).toBe(false);
  });
});


describe('runtime matrix — Groq / openai-compatible (enterprise)', () => {

  it('classifies as enterprise and registers only the enterprise slot, suppressing the branded openai slot', async () => {
    const env: RegistryEnvInput = {
      OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
      OPENAI_API_KEY: 'gsk-groq',
    };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('enterprise');

    const registry = await buildRegistry(env);

    expect(registry.providers.map((p) => p.id)).toEqual(['enterprise']);
    expect(registry.providers.map((p) => p.id)).not.toContain('openai');

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('enterprise');
    expect(diagnostics.providers[0].privacyClass).toBe('private-cloud');
  });
});


describe('runtime matrix — multi-provider', () => {

  it('classifies as multi-provider and registers both configured brands, no custom base URL', async () => {
    const env: RegistryEnvInput = { ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai' };
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('multi-provider');

    const registry = await buildRegistry(env);

    expect(registry.providers.map((p) => p.id).sort()).toEqual(['anthropic', 'openai']);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('multi-provider');
  });
});


describe('runtime matrix — no LLM configured', () => {

  it('classifies as offline-limited with an empty registry and the llm-turns degradation', async () => {
    const env: RegistryEnvInput = {};
    const detected = detectConfig(env);

    expect(classifyProfile(detected)).toBe('offline-limited');

    const registry = await buildRegistry(env);

    expect(registry.providers).toEqual([]);

    const diagnostics = buildRuntimeDiagnostics(registry, detected);

    expect(diagnostics.profile).toBe('offline-limited');
    expect(diagnostics.degradedFeatures).toEqual([{ feature: 'llm-turns', reason: 'no provider configured' }]);
  });
});


describe('runtime matrix — router DegradePolicy, zero enumerable candidates', () => {
  const router = new CapabilityRouter();

  it.each(['fail', 'degrade', 'ask', 'skip'] as const)(
    'throws RouterError under %s policy for an offline-limited (empty) registry',
    async (policy) => {
      const env: RegistryEnvInput = {};
      const registry = await buildRegistry(env);

      expect(() => router.resolve(baseRequirements(), registry, { degradePolicy: policy })).toThrow(RouterError);
    },
  );

  it.each(['fail', 'degrade', 'ask', 'skip'] as const)(
    'throws RouterError under %s policy when the only configured provider has zero models',
    async (policy) => {
      const env: RegistryEnvInput = { GEMINI_API_KEY: 'gm-key' };
      const registry = await buildRegistry(env);

      expect(() => router.resolve(baseRequirements(), registry, { degradePolicy: policy })).toThrow(RouterError);
    },
  );
});


describe('runtime matrix — router DegradePolicy, candidate exists but fails hard filters', () => {
  const router = new CapabilityRouter();

  async function toolUseUnsatisfiableRegistry() {
    const env: RegistryEnvInput = { OLLAMA_BASE_URL: 'http://localhost:11434' };

    return buildRegistry(env, { listOllamaModels: () => [NO_TOOL_USE_MODEL] });
  }

  it('fail throws RouterError naming the local Ollama model lacking toolUse', async () => {
    const registry = await toolUseUnsatisfiableRegistry();

    expect(() =>
      router.resolve(baseRequirements({ requiredCapabilities: ['toolUse'] }), registry, { degradePolicy: 'fail' }),
    ).toThrow(RouterError);
  });

  it('degrade returns the local model with degraded:true and toolUse in unmet', async () => {
    const registry = await toolUseUnsatisfiableRegistry();

    const resolution = router.resolve(
      baseRequirements({ requiredCapabilities: ['toolUse'] }),
      registry,
      { degradePolicy: 'degrade' },
    );

    expect(resolution.degraded).toBe(true);
    expect(resolution.model.id).toBe('no-tool-use-model');
    expect(resolution.unmet).toContain('toolUse');
  });

  it('ask returns needsConfirmation:true and degraded:true without throwing', async () => {
    const registry = await toolUseUnsatisfiableRegistry();

    const resolution = router.resolve(
      baseRequirements({ requiredCapabilities: ['toolUse'] }),
      registry,
      { degradePolicy: 'ask' },
    );

    expect(resolution.needsConfirmation).toBe(true);
    expect(resolution.degraded).toBe(true);
  });
});
