import type { LlmModelDescriptor } from '../capability/contract';

import { buildRegistry, listModels } from './provider-registry';
import { ANTHROPIC_MODEL_CATALOG, OPENAI_MODEL_CATALOG } from './model-catalog';


describe('listModels', () => {

  it('returns the static OpenAI catalog with normalized capabilities', async () => {
    const models = await listModels('openai');

    expect(models).toBe(OPENAI_MODEL_CATALOG);
    expect(models[0].capabilities.toolUse).toBe(true);
    expect(typeof models[0].capabilities.contextWindowTokens).toBe('number');
  });

  it('returns the static Anthropic catalog with normalized capabilities', async () => {
    const models = await listModels('anthropic');

    expect(models).toBe(ANTHROPIC_MODEL_CATALOG);
    expect(models[0].costClass).toBeDefined();
    expect(models[0].latencyClass).toBeDefined();
  });

  it('returns an empty ollama list when no listOllamaModels dependency is injected', async () => {
    const models = await listModels('ollama');

    expect(models).toEqual([]);
  });

  it('returns injected ollama models when the dependency is provided', async () => {
    const injected: LlmModelDescriptor[] = [
      {
        id: 'llama3.2',
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
      },
    ];

    const models = await listModels('ollama', { listOllamaModels: () => injected });

    expect(models).toEqual(injected);
  });

  it('returns an empty enterprise list by default, never reusing the OpenAI catalog', async () => {
    const models = await listModels('enterprise');

    expect(models).toEqual([]);
    expect(models).not.toBe(OPENAI_MODEL_CATALOG);
  });

  it('returns injected enterprise models when listEnterpriseModels is provided', async () => {
    const injected: LlmModelDescriptor[] = [
      {
        id: 'custom-deployment-model',
        capabilities: {
          toolUse: true,
          structuredOutput: false,
          vision: false,
          streaming: true,
          longContext: false,
          contextWindowTokens: 32_000,
        },
        costClass: 'medium',
        latencyClass: 'interactive',
      },
    ];

    const models = await listModels('enterprise', { listEnterpriseModels: () => injected });

    expect(models).toEqual(injected);
  });
});


describe('buildRegistry', () => {

  it('returns offline-limited with no providers when nothing is configured', async () => {
    const registry = await buildRegistry({});

    expect(registry.profile).toBe('offline-limited');
    expect(registry.providers).toEqual([]);
  });

  it('returns local-only with a single local provider for ollama-only config', async () => {
    const registry = await buildRegistry({ OLLAMA_BASE_URL: 'http://localhost:11434' });

    expect(registry.profile).toBe('local-only');
    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0]).toMatchObject({ id: 'ollama', privacyClass: 'local' });
  });

  it('returns single-provider for exactly one cloud brand', async () => {
    const registry = await buildRegistry({ ANTHROPIC_API_KEY: 'sk-ant' });

    expect(registry.profile).toBe('single-provider');
    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0]).toMatchObject({ id: 'anthropic', privacyClass: 'public-cloud' });
    expect(registry.providers[0].models).toBe(ANTHROPIC_MODEL_CATALOG);
  });

  it('returns multi-provider when two or more providers are configured', async () => {
    const registry = await buildRegistry({
      ANTHROPIC_API_KEY: 'sk-ant',
      OPENAI_API_KEY: 'sk-oai',
    });

    expect(registry.profile).toBe('multi-provider');
    expect(registry.providers.map((p) => p.id).sort()).toEqual(['anthropic', 'openai']);
  });

  it('returns enterprise with a metadata-only RegisteredProvider, no complete/stream/ping', async () => {
    const registry = await buildRegistry({ OPENAI_BASE_URL: 'https://llm.internal.example.com/v1' });

    expect(registry.profile).toBe('enterprise');
    expect(registry.providers).toHaveLength(1);

    const enterpriseProvider = registry.providers[0];

    expect(enterpriseProvider.id).toBe('enterprise');
    expect(enterpriseProvider.privacyClass).toBe('private-cloud');
    expect(enterpriseProvider.models).toEqual([]);
    expect(enterpriseProvider).not.toHaveProperty('complete');
    expect(enterpriseProvider).not.toHaveProperty('stream');
    expect(enterpriseProvider).not.toHaveProperty('ping');
  });

  it('populates enterprise models from deps.listEnterpriseModels when injected', async () => {
    const injected: LlmModelDescriptor[] = [
      {
        id: 'custom-deployment-model',
        capabilities: {
          toolUse: true,
          structuredOutput: false,
          vision: false,
          streaming: true,
          longContext: false,
          contextWindowTokens: 32_000,
        },
        costClass: 'medium',
        latencyClass: 'interactive',
      },
    ];

    const registry = await buildRegistry(
      { OPENAI_BASE_URL: 'https://llm.internal.example.com/v1' },
      { listEnterpriseModels: () => injected },
    );

    expect(registry.providers[0].models).toEqual(injected);
  });

  it('registers enterprise only (not branded openai) when OPENAI_BASE_URL and OPENAI_API_KEY are both set', async () => {
    const registry = await buildRegistry({
      OPENAI_BASE_URL: 'https://llm.internal.example.com/v1',
      OPENAI_API_KEY: 'sk-shared',
    });

    expect(registry.profile).toBe('enterprise');
    expect(registry.providers.map((p) => p.id)).toEqual(['enterprise']);
    expect(registry.providers[0].models).not.toBe(OPENAI_MODEL_CATALOG);
  });
});
