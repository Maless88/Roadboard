import type { LlmModelDescriptor, TaskRequirements } from '../capability/contract';
import type { BuiltRegistry, RegisteredProvider } from '../registry/types';
import { CapabilityRouter } from './capability-router';
import { RouterError } from './types';

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
    costClass: 'medium',
    latencyClass: 'interactive',
    ...overrides,
  };
}


function provider(overrides: Partial<RegisteredProvider> & { id: string }): RegisteredProvider {
  return {
    privacyClass: 'public-cloud',
    models: [],
    ...overrides,
  };
}


function requirements(overrides: Partial<TaskRequirements> = {}): TaskRequirements {
  return {
    role: 'dev',
    requiredCapabilities: [],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'high',
    maxLatencyClass: 'batch',
    ...overrides,
  };
}


describe('CapabilityRouter.resolve — capability filtering', () => {
  const router = new CapabilityRouter();

  it('rejects a candidate missing a required boolean capability', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'no-vision', capabilities: {
        toolUse: true, structuredOutput: true, vision: false, streaming: true, longContext: true, contextWindowTokens: 100_000,
      } })] })],
    };

    expect(() => router.resolve(requirements({ requiredCapabilities: ['vision'] }), registry)).toThrow(RouterError);
  });

  it('accepts a candidate satisfying all required boolean capabilities', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'vision-model', capabilities: {
        toolUse: true, structuredOutput: true, vision: true, streaming: true, longContext: true, contextWindowTokens: 100_000,
      } })] })],
    };

    const resolution = router.resolve(requirements({ requiredCapabilities: ['vision', 'toolUse'] }), registry);

    expect(resolution.model.id).toBe('vision-model');
    expect(resolution.degraded).toBe(false);
  });

  it('ignores contextWindowTokens as a no-op in requiredCapabilities', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'm1' })] })],
    };

    const resolution = router.resolve(
      requirements({ requiredCapabilities: ['contextWindowTokens' as keyof LlmModelDescriptor['capabilities']] }),
      registry,
    );

    expect(resolution.model.id).toBe('m1');
    expect(resolution.degraded).toBe(false);
  });
});


describe('CapabilityRouter.resolve — ceilings', () => {
  const router = new CapabilityRouter();

  it('rejects a candidate whose privacyClass exceeds the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', privacyClass: 'public-cloud', models: [model({ id: 'm1' })] })],
    };

    expect(() => router.resolve(requirements({ maxPrivacyClass: 'local' }), registry)).toThrow(RouterError);
  });

  it('accepts a candidate whose privacyClass is exactly at the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'enterprise', privacyClass: 'private-cloud', models: [model({ id: 'm1' })] })],
    };

    const resolution = router.resolve(requirements({ maxPrivacyClass: 'private-cloud' }), registry);

    expect(resolution.model.id).toBe('m1');
  });

  it('rejects a candidate whose costClass exceeds the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', models: [model({ id: 'm1', costClass: 'high' })] })],
    };

    expect(() => router.resolve(requirements({ maxCostClass: 'low' }), registry)).toThrow(RouterError);
  });

  it('accepts a candidate whose costClass is exactly at the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', models: [model({ id: 'm1', costClass: 'medium' })] })],
    };

    const resolution = router.resolve(requirements({ maxCostClass: 'medium' }), registry);

    expect(resolution.model.id).toBe('m1');
  });

  it('rejects a candidate whose latencyClass exceeds the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', models: [model({ id: 'm1', latencyClass: 'batch' })] })],
    };

    expect(() => router.resolve(requirements({ maxLatencyClass: 'interactive' }), registry)).toThrow(RouterError);
  });

  it('accepts a candidate whose latencyClass is exactly at the ceiling', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', models: [model({ id: 'm1', latencyClass: 'interactive' })] })],
    };

    const resolution = router.resolve(requirements({ maxLatencyClass: 'interactive' }), registry);

    expect(resolution.model.id).toBe('m1');
  });
});


describe('CapabilityRouter.resolve — ranking / ordered fallback', () => {
  const router = new CapabilityRouter();

  it('orders fallbacks cheapest first, then fastest, then most-private, with the chosen candidate first', () => {
    const registry: BuiltRegistry = {
      profile: 'multi-provider',
      providers: [
        provider({ id: 'anthropic', privacyClass: 'public-cloud', models: [
          model({ id: 'expensive-slow', costClass: 'high', latencyClass: 'batch' }),
        ] }),
        provider({ id: 'ollama', privacyClass: 'local', models: [
          model({ id: 'free-fast', costClass: 'free', latencyClass: 'realtime' }),
        ] }),
        provider({ id: 'openai', privacyClass: 'public-cloud', models: [
          model({ id: 'cheap-mid', costClass: 'low', latencyClass: 'interactive' }),
        ] }),
      ],
    };

    const resolution = router.resolve(requirements(), registry);

    expect(resolution.model.id).toBe('free-fast');
    expect(resolution.fallbacks.map((f) => f.model.id)).toEqual(['free-fast', 'cheap-mid', 'expensive-slow']);
    expect(resolution.fallbacks[0].model.id).toBe(resolution.model.id);
  });

  it('ties broken by registry order (provider index, then model index) for full determinism', () => {
    const registry: BuiltRegistry = {
      profile: 'multi-provider',
      providers: [
        provider({ id: 'anthropic', privacyClass: 'public-cloud', models: [model({ id: 'a1' }), model({ id: 'a2' })] }),
        provider({ id: 'openai', privacyClass: 'public-cloud', models: [model({ id: 'o1' })] }),
      ],
    };

    const resolution = router.resolve(requirements(), registry);

    expect(resolution.fallbacks.map((f) => f.model.id)).toEqual(['a1', 'a2', 'o1']);
  });
});


describe('CapabilityRouter.resolve — empty registry', () => {
  const router = new CapabilityRouter();
  const emptyRegistry: BuiltRegistry = { profile: 'offline-limited', providers: [] };

  it.each(['fail', 'degrade', 'ask', 'skip'] as const)('throws RouterError under %s policy when no providers exist', (policy) => {
    expect(() => router.resolve(requirements(), emptyRegistry, { degradePolicy: policy })).toThrow(RouterError);
  });

  it('throws RouterError when providers exist but have no models', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [] })],
    };

    expect(() => router.resolve(requirements(), registry)).toThrow(RouterError);
  });
});


describe('CapabilityRouter.resolve — degrade policy branches', () => {
  const router = new CapabilityRouter();

  function unsatisfiableRegistry(): BuiltRegistry {
    return {
      profile: 'single-provider',
      providers: [provider({ id: 'openai', privacyClass: 'public-cloud', models: [
        model({ id: 'over-budget', costClass: 'high', latencyClass: 'batch' }),
      ] })],
    };
  }

  it('fail (default) throws RouterError naming what could not be met', () => {
    const registry = unsatisfiableRegistry();

    expect(() => router.resolve(requirements({ maxCostClass: 'low' }), registry)).toThrow(RouterError);
  });

  it('degrade returns the min-distance candidate with degraded:true and unmet populated', () => {
    const registry = unsatisfiableRegistry();

    const resolution = router.resolve(
      requirements({ maxCostClass: 'low', maxLatencyClass: 'realtime' }),
      registry,
      { degradePolicy: 'degrade' },
    );

    expect(resolution.degraded).toBe(true);
    expect(resolution.model.id).toBe('over-budget');
    expect(resolution.unmet).toEqual(expect.arrayContaining(['costClass>max', 'latencyClass>max']));
    expect(resolution.needsConfirmation).toBeUndefined();
  });

  it('ask returns the same candidate as degrade but sets needsConfirmation and does not throw', () => {
    const registry = unsatisfiableRegistry();

    const resolution = router.resolve(
      requirements({ maxCostClass: 'low', maxLatencyClass: 'realtime' }),
      registry,
      { degradePolicy: 'ask' },
    );

    expect(resolution.degraded).toBe(true);
    expect(resolution.needsConfirmation).toBe(true);
    expect(resolution.model.id).toBe('over-budget');
  });

  it('skip drops declared-optional capabilities and returns normally when that resolves it', () => {
    const registry: BuiltRegistry = {
      profile: 'single-provider',
      providers: [provider({ id: 'anthropic', models: [model({ id: 'no-vision', capabilities: {
        toolUse: true, structuredOutput: true, vision: false, streaming: true, longContext: true, contextWindowTokens: 100_000,
      } })] })],
    };

    const resolution = router.resolve(
      requirements({ requiredCapabilities: ['vision'] }),
      registry,
      { degradePolicy: 'skip', optionalCapabilities: ['vision'] },
    );

    expect(resolution.degraded).toBe(false);
    expect(resolution.model.id).toBe('no-vision');
  });

  it('skip falls through to fail when dropping optional capabilities is not enough', () => {
    const registry = unsatisfiableRegistry();

    expect(() =>
      router.resolve(
        requirements({ maxCostClass: 'low', requiredCapabilities: ['vision'] }),
        registry,
        { degradePolicy: 'skip', optionalCapabilities: ['vision'] },
      ),
    ).toThrow(RouterError);
  });
});


describe('CapabilityRouter.resolve — deterministic min-distance selection', () => {
  const router = new CapabilityRouter();

  it('prefers the candidate with the smallest total distance across multiple violations', () => {
    const registry: BuiltRegistry = {
      profile: 'multi-provider',
      providers: [
        provider({ id: 'anthropic', privacyClass: 'public-cloud', models: [
          model({ id: 'far', costClass: 'high', latencyClass: 'batch', capabilities: {
            toolUse: false, structuredOutput: true, vision: false, streaming: true, longContext: true, contextWindowTokens: 100_000,
          } }),
        ] }),
        provider({ id: 'openai', privacyClass: 'public-cloud', models: [
          model({ id: 'closer', costClass: 'medium', latencyClass: 'interactive' }),
        ] }),
      ],
    };

    const resolution = router.resolve(
      requirements({ maxCostClass: 'low', maxLatencyClass: 'realtime', requiredCapabilities: ['toolUse'] }),
      registry,
      { degradePolicy: 'degrade' },
    );

    expect(resolution.model.id).toBe('closer');
  });

  it('is deterministic across repeated calls with identical input', () => {
    const registry: BuiltRegistry = {
      profile: 'multi-provider',
      providers: [
        provider({ id: 'anthropic', models: [model({ id: 'a', costClass: 'high' })] }),
        provider({ id: 'openai', models: [model({ id: 'b', costClass: 'high' })] }),
      ],
    };

    const opts = { degradePolicy: 'degrade' as const };
    const first = router.resolve(requirements({ maxCostClass: 'free' }), registry, opts);
    const second = router.resolve(requirements({ maxCostClass: 'free' }), registry, opts);

    expect(first.model.id).toBe(second.model.id);
    expect(first.model.id).toBe('a');
  });
});
