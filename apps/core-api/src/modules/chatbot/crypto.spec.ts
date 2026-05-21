import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';

import { encryptApiKey, decryptApiKey } from './crypto';


describe('chatbot crypto', () => {

  beforeAll(() => {

    process.env.CHATBOT_KEY = randomBytes(32).toString('base64');
  });


  it('round-trips a plaintext API key', () => {

    const plaintext = 'sk-test-1234567890abcdef';
    const enc = encryptApiKey(plaintext);

    expect(enc).not.toBe(plaintext);
    expect(decryptApiKey(enc)).toBe(plaintext);
  });


  it('produces a different ciphertext on each encrypt (random IV)', () => {

    const a = encryptApiKey('same-secret');
    const b = encryptApiKey('same-secret');

    expect(a).not.toBe(b);
    expect(decryptApiKey(a)).toBe('same-secret');
    expect(decryptApiKey(b)).toBe('same-secret');
  });


  it('throws on tampered ciphertext', () => {

    const enc = encryptApiKey('secret');
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');

    expect(() => decryptApiKey(tampered)).toThrow();
  });


  it('throws when CHATBOT_KEY is missing', () => {

    const prev = process.env.CHATBOT_KEY;
    delete process.env.CHATBOT_KEY;

    try {
      expect(() => encryptApiKey('x')).toThrow(/CHATBOT_KEY/);
    } finally {
      process.env.CHATBOT_KEY = prev;
    }
  });
});
