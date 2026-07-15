/**
 * Chatbot Config Integration Suite
 *
 * Verifies the per-user chatbot config endpoints in core-api:
 *
 *  1. Unauthenticated requests are rejected.
 *  2. GET /chatbot/config returns null before any save.
 *  3. PUT /chatbot/config (ollama) persists baseUrl + model and reports hasApiKey=false.
 *  4. PUT /chatbot/config (openai) persists provider + model and reports hasApiKey=true,
 *     but never echoes the plaintext API key back.
 *  5. Updating without resending `apiKey` keeps the previously stored key.
 *  6. DELETE /chatbot/config removes the row.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Credentials for the live-stack integration run come from the environment —
// never hardcode real passwords in specs.
const TEST_USERNAME = process.env.RB_TEST_USERNAME ?? 'admin';
const TEST_PASSWORD = process.env.RB_TEST_PASSWORD ?? '';


const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';


interface LoginResp {
  token: string;
  userId: string;
}


interface ConfigView {
  id: string;
  provider: string;
  modelName: string;
  ollamaBaseUrl: string | null;
  hasApiKey: boolean;
  isActive: boolean;
}


function auth(token: string): Record<string, string> {

  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}


describe('Chatbot Config Integration', () => {

  let token: string;


  beforeAll(async () => {

    const [core, authSvc] = await Promise.all([
      fetch(`${CORE_URL}/health`).catch(() => null),
      fetch(`${AUTH_URL}/health`).catch(() => null),
    ]);

    if (!core?.ok || !authSvc?.ok) {
      throw new Error('Services not running. Start core-api (:3001) and auth-access (:3002) first.');
    }

    const login = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    expect(login.status).toBe(201);
    const data = await login.json() as LoginResp;
    token = data.token;
  });


  afterAll(async () => {

    if (token) {
      await fetch(`${CORE_URL}/chatbot/config`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
    }
  });


  it('rejects unauthenticated GET', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`);
    expect(res.status).toBe(401);
  });


  it('returns null when no config exists yet', async () => {

    // ensure clean state
    await fetch(`${CORE_URL}/chatbot/config`, { method: 'DELETE', headers: auth(token) });

    const res = await fetch(`${CORE_URL}/chatbot/config`, { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });


  it('saves an ollama config', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({
        provider: 'ollama',
        ollamaBaseUrl: 'http://localhost:11434',
        modelName: 'llama3.2',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ConfigView;
    expect(body.provider).toBe('ollama');
    expect(body.modelName).toBe('llama3.2');
    expect(body.ollamaBaseUrl).toBe('http://localhost:11434');
    expect(body.hasApiKey).toBe(false);
  });


  it('rejects ollama config without baseUrl', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ provider: 'ollama', modelName: 'llama3.2' }),
    });

    expect(res.status).toBe(400);
  });


  it('saves an openai config and never echoes the apiKey', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-test-roundtrip',
        modelName: 'gpt-4o-mini',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ConfigView;
    expect(body.provider).toBe('openai');
    expect(body.hasApiKey).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-test-roundtrip');
    expect(body.ollamaBaseUrl).toBeNull();
  });


  it('preserves the stored apiKey when omitted on subsequent update', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({
        provider: 'openai',
        modelName: 'gpt-4o',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ConfigView;
    expect(body.modelName).toBe('gpt-4o');
    expect(body.hasApiKey).toBe(true);
  });


  it('rejects invalid provider', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ provider: 'mistral', modelName: 'x' }),
    });

    expect(res.status).toBe(400);
  });


  it('deletes the config', async () => {

    const del = await fetch(`${CORE_URL}/chatbot/config`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(del.status).toBe(204);

    const after = await fetch(`${CORE_URL}/chatbot/config`, { headers: auth(token) });
    expect(after.status).toBe(200);
    expect(await after.json()).toBeNull();
  });


  it('rejects /chatbot/chat when no config exists', async () => {

    const res = await fetch(`${CORE_URL}/chatbot/chat`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // 404 because loadRuntimeConfig throws NotFoundException
    expect(res.status).toBe(404);
  });
});
