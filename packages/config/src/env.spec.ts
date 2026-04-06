import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { requireEnv, optionalEnv } from './env';

const TEST_VAR = 'RB_TEST_ENV_VAR';


describe('requireEnv', () => {

  beforeEach(() => {
    delete process.env[TEST_VAR];
  });


  afterEach(() => {
    delete process.env[TEST_VAR];
  });


  it('returns value when env var exists', () => {
    process.env[TEST_VAR] = 'hello';
    expect(requireEnv(TEST_VAR)).toBe('hello');
  });


  it('throws when env var missing', () => {
    expect(() => requireEnv(TEST_VAR)).toThrow(
      `Missing required environment variable: ${TEST_VAR}`,
    );
  });
});


describe('optionalEnv', () => {

  beforeEach(() => {
    delete process.env[TEST_VAR];
  });


  afterEach(() => {
    delete process.env[TEST_VAR];
  });


  it('returns value when env var exists', () => {
    process.env[TEST_VAR] = 'present';
    expect(optionalEnv(TEST_VAR, 'fallback')).toBe('present');
  });


  it('returns fallback when env var missing', () => {
    expect(optionalEnv(TEST_VAR, 'fallback')).toBe('fallback');
  });
});
