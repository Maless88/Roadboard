import { describe, it, expect, beforeAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';


interface LoginResponse {
  token: string;
  userId: string;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


// 8x8 black PNG (smallest valid)
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08,
  0x08, 0x06, 0x00, 0x00, 0x00, 0xc4, 0x0f, 0xbe,
  0x8b, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00,
  0x00, 0x00, 0x05, 0x00, 0x01, 0x5e, 0xf3, 0xff,
  0x61, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);


describe('Project Thumbnail Upload Integration', () => {

  let token: string;
  let projectId: string;


  beforeAll(async () => {

    const healthChecks = await Promise.all([
      fetch(`${AUTH_URL}/health`).catch(() => null),
      fetch(`${CORE_URL}/health`).catch(() => null),
    ]);

    if (!healthChecks[0]?.ok || !healthChecks[1]?.ok) {
      throw new Error(
        'Services not running. Start auth-access (:3002) and core-api (:3001) before running integration tests.',
      );
    }

    const loginRes = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alessio', password: '***REDACTED***' }),
    });

    if (!loginRes.ok) throw new Error('Login failed — seed user not present');

    const loginData = (await loginRes.json()) as LoginResponse;
    token = loginData.token;

    const teamRes = await fetch(`${CORE_URL}/teams`, { headers: authHeaders(token) });
    const teams = (await teamRes.json()) as Array<{ id: string }>;
    const ownerTeamId = teams[0]?.id;

    if (!ownerTeamId) throw new Error('No team available');

    const slug = `thumb-test-${Date.now()}`;
    const projRes = await fetch(`${CORE_URL}/projects`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Thumb Test', slug, ownerTeamId, status: 'draft' }),
    });

    if (!projRes.ok) throw new Error('Failed to create test project');

    const proj = (await projRes.json()) as { id: string };
    projectId = proj.id;
  });


  it('updates homeUrl via PATCH /projects/:id', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ homeUrl: 'https://example.com' }),
    });

    expect(res.ok).toBe(true);
    const project = (await res.json()) as { homeUrl: string | null };
    expect(project.homeUrl).toBe('https://example.com');
  });


  it('rejects malformed homeUrl', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ homeUrl: 'not-a-url' }),
    });

    expect(res.status).toBe(400);
  });


  it('uploads a thumbnail and serves it as static', async () => {

    const form = new FormData();
    form.append('file', new Blob([PNG_HEADER], { type: 'image/png' }), 'tiny.png');

    const res = await fetch(`${CORE_URL}/projects/${projectId}/thumbnail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.ok).toBe(true);

    const body = (await res.json()) as { thumbnailUrl: string };
    expect(body.thumbnailUrl).toMatch(/^\/uploads\/thumbnails\//);

    // Verify static serving
    const fileRes = await fetch(`${CORE_URL}${body.thumbnailUrl}`);
    expect(fileRes.ok).toBe(true);
    expect(fileRes.headers.get('content-type')).toMatch(/image\/png/);
  });


  it('rejects non-image upload', async () => {

    const form = new FormData();
    form.append('file', new Blob([Buffer.from('hello world')], { type: 'text/plain' }), 'bad.txt');

    const res = await fetch(`${CORE_URL}/projects/${projectId}/thumbnail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    expect(res.status).toBe(400);
  });
});
