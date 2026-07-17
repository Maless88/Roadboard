import type { LlmModelDescriptor } from '../capability/contract';
import type { BuiltRegistry, RegisteredProvider } from '../registry/types';
import { planAgentTurn } from './planner';


function model(overrides: Partial<LlmModelDescriptor> & { id: string }): LlmModelDescriptor {
  return {
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      vision: false,
      streaming: true,
      longContext: true,
      contextWindowTokens: 100_000,
    },
    costClass: 'high',
    latencyClass: 'batch',
    ...overrides,
  };
}


function provider(overrides: Partial<RegisteredProvider> & { id: RegisteredProvider['id'] }): RegisteredProvider {
  return {
    privacyClass: 'public-cloud',
    models: [],
    ...overrides,
  };
}


describe('planAgentTurn', () => {

  it('ok: true happy path — resolves a capable candidate for a dev turn (not degraded)', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'claude' })] })],
    };

    const plan = planAgentTurn('dev', registry);

    expect(plan.ok).toBe(true);

    if (plan.ok) {
      expect(plan.resolution.degraded).toBe(false);
      expect(plan.resolution.provider.id).toBe('anthropic');
      expect(plan.resolution.model.id).toBe('claude');
      expect(plan.requirements.role).toBe('dev');
    }
  });


  it('builds the context pack alongside the resolution', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'claude' })] })],
    };

    const plan = planAgentTurn('assistant', registry, {
      context: { systemPrompt: 'hello world' },
    });

    expect(plan.contextPack.messages).toHaveLength(1);
    expect(plan.contextPack.messages[0].content).toContain('hello world');
  });


  it('local-only path (>=1 model) — degrades via the router when capabilities fall short', () => {
    const registry: BuiltRegistry = {
      profile: 'local-only',
      providers: [
        provider({
          id: 'ollama',
          privacyClass: 'local',
          models: [
            model({
              id: 'llama-small',
              costClass: 'free',
              latencyClass: 'realtime',
              capabilities: {
                toolUse: false,
                structuredOutput: false,
                vision: false,
                streaming: true,
                longContext: false,
                contextWindowTokens: 8_000,
              },
            }),
          ],
        }),
      ],
    };

    // dev requires toolUse + longContext, which the local model lacks → degraded, not thrown.
    const plan = planAgentTurn('dev', registry);

    expect(plan.ok).toBe(true);

    if (plan.ok) {
      expect(plan.resolution.degraded).toBe(true);
      expect(plan.resolution.model.id).toBe('llama-small');
      expect(plan.resolution.unmet.length).toBeGreaterThan(0);
    }
  });


  it('ok: false no-candidates — offline-limited registry with empty providers, no throw', () => {
    const registry: BuiltRegistry = { profile: 'offline-limited', providers: [] };

    const plan = planAgentTurn('intake', registry);

    expect(plan.ok).toBe(false);

    if (!plan.ok) {
      expect(plan.reason).toBe('no-candidates');
      expect(plan.requirements.role).toBe('intake');
      expect(plan.contextPack).toBeDefined();
      expect(plan.detail).toContain('offline-limited');
    }
  });


  it('ok: false no-candidates — providers present but exposing zero models', () => {
    const registry: BuiltRegistry = {
      profile: 'local-only',
      providers: [provider({ id: 'ollama', privacyClass: 'local', models: [] })],
    };

    const plan = planAgentTurn('router', registry, { context: { systemPrompt: 'x' } });

    expect(plan.ok).toBe(false);

    if (!plan.ok) {
      expect(plan.reason).toBe('no-candidates');
      expect(plan.contextPack.messages).toHaveLength(1);
    }
  });
});
