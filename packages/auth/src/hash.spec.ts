import { describe, it, expect } from 'vitest';

import { hashPassword, verifyPassword, generateToken, hashToken } from './hash';


describe('hashPassword', () => {

  it('returns a string with salt:hash format', async () => {
    const result = await hashPassword('my-secret');
    const parts = result.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]!.length).toBeGreaterThan(0);
    expect(parts[1]!.length).toBeGreaterThan(0);
  });
});


describe('verifyPassword', () => {

  it('returns true for correct password', async () => {
    const hashed = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hashed);
    expect(result).toBe(true);
  });


  it('returns false for wrong password', async () => {
    const hashed = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hashed);
    expect(result).toBe(false);
  });
});


describe('generateToken', () => {

  it('returns a 64-char hex string', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});


describe('hashToken', () => {

  it('returns a consistent hash for same input', () => {
    const token = 'test-token-value';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });
});
