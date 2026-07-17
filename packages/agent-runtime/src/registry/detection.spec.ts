import { classifyProfile, detectConfig } from './detection';
import type { RegistryEnvInput } from './types';


describe('detectConfig', () => {

  it('detects no provider when the env is empty', () => {
    const detected = detectConfig({});

    expect(detected).toEqual({
      anthropic: false,
      openai: false,
      ollama: false,
      gemini: false,
      enterprise: false,
      enterpriseBaseUrl: undefined,
      enterpriseApiKey: undefined,
    });
  });

  it('detects gemini from GEMINI_API_KEY', () => {
    const detected = detectConfig({ GEMINI_API_KEY: 'gm-test' });

    expect(detected.gemini).toBe(true);
  });

  it('detects enterprise from a non-empty OPENAI_BASE_URL without requiring OPENAI_API_KEY', () => {
    const env: RegistryEnvInput = { OPENAI_BASE_URL: 'https://llm.internal.example.com/v1' };
    const detected = detectConfig(env);

    expect(detected.enterprise).toBe(true);
    expect(detected.enterpriseBaseUrl).toBe('https://llm.internal.example.com/v1');
    expect(detected.enterpriseApiKey).toBeUndefined();
  });

  it('ignores a blank OPENAI_BASE_URL', () => {
    const detected = detectConfig({ OPENAI_BASE_URL: '   ' });

    expect(detected.enterprise).toBe(false);
    expect(detected.enterpriseBaseUrl).toBeUndefined();
  });

  it('associates OPENAI_API_KEY as enterprise config when both are present', () => {
    const detected = detectConfig({
      OPENAI_BASE_URL: 'https://llm.internal.example.com/v1',
      OPENAI_API_KEY: 'sk-shared',
    });

    expect(detected.enterprise).toBe(true);
    expect(detected.enterpriseApiKey).toBe('sk-shared');
  });
});


describe('classifyProfile', () => {

  it('classifies offline-limited when nothing is detected', () => {
    const profile = classifyProfile(detectConfig({}));

    expect(profile).toBe('offline-limited');
  });

  it('classifies local-only when only ollama is detected', () => {
    const profile = classifyProfile(detectConfig({ OLLAMA_BASE_URL: 'http://localhost:11434' }));

    expect(profile).toBe('local-only');
  });

  it('classifies single-provider when exactly one cloud brand is detected', () => {
    const profile = classifyProfile(detectConfig({ ANTHROPIC_API_KEY: 'sk-ant' }));

    expect(profile).toBe('single-provider');
  });

  it('classifies single-provider when only gemini is detected', () => {
    const profile = classifyProfile(detectConfig({ GEMINI_API_KEY: 'gm-test' }));

    expect(profile).toBe('single-provider');
  });

  it('counts gemini toward multi-provider', () => {
    const profile = classifyProfile(
      detectConfig({ GEMINI_API_KEY: 'gm-test', ANTHROPIC_API_KEY: 'sk-ant' }),
    );

    expect(profile).toBe('multi-provider');
  });

  it('classifies multi-provider when two or more providers are detected', () => {
    const profile = classifyProfile(
      detectConfig({ ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oai' }),
    );

    expect(profile).toBe('multi-provider');
  });

  it('classifies enterprise with precedence over every other combination', () => {
    const profile = classifyProfile(
      detectConfig({
        ANTHROPIC_API_KEY: 'sk-ant',
        OPENAI_API_KEY: 'sk-oai',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OPENAI_BASE_URL: 'https://llm.internal.example.com/v1',
      }),
    );

    expect(profile).toBe('enterprise');
  });
});
