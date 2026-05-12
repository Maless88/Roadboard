import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GraphDbClient, applyGraphSchema } from './index';


describe('GraphDbClient (live against Memgraph)', () => {

  const client = new GraphDbClient();
  let reachable = false;

  beforeAll(async () => {
    reachable = await client.ping().catch(() => false);

    if (reachable) {
      await applyGraphSchema(client);
    }
  });


  afterAll(async () => {

    if (reachable) {
      await client.run(
        'MATCH (n:App {id: $id}) DETACH DELETE n',
        { id: 'test-smoke-app' },
        { mode: 'write' },
      ).catch(() => undefined);
    }

    await client.close();
  });


  it('ping returns true when Memgraph is reachable', async () => {

    if (!reachable) return;
    expect(await client.ping()).toBe(true);
  });


  it('can MERGE a node and read it back', async () => {

    if (!reachable) return;

    await client.run(
      'MERGE (n:App {id: $id}) SET n.name = $name, n.projectId = $pid',
      { id: 'test-smoke-app', name: 'web-app', pid: 'p1' },
      { mode: 'write' },
    );

    const rows = await client.run<{ id: string; name: string }>(
      'MATCH (n:App {id: $id}) RETURN n.id AS id, n.name AS name',
      { id: 'test-smoke-app' },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('test-smoke-app');
    expect(rows[0].name).toBe('web-app');
  });


  it('creates DEPENDS_ON edge and traverses it', async () => {

    if (!reachable) return;

    await client.run(
      'MERGE (a:App {id: "test-smoke-app"}) MERGE (p:Package {id: "test-smoke-pkg"}) MERGE (a)-[:DEPENDS_ON]->(p)',
      {},
      { mode: 'write' },
    );

    const rows = await client.run<{ from: string; to: string }>(
      'MATCH (a:App)-[:DEPENDS_ON]->(p:Package) WHERE a.id = "test-smoke-app" RETURN a.id AS from, p.id AS to',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].from).toBe('test-smoke-app');
    expect(rows[0].to).toBe('test-smoke-pkg');

    await client.run(
      'MATCH (p:Package {id: "test-smoke-pkg"}) DETACH DELETE p',
      {},
      { mode: 'write' },
    );
  });
});


describe('GraphDbClient (unit)', () => {

  it('constructor accepts a custom config', () => {
    const c = new GraphDbClient({ url: 'bolt://fake:7687', username: '', password: '' });
    expect(c).toBeDefined();
  });


  it('ping returns false when url is unreachable', async () => {
    const c = new GraphDbClient({ url: 'bolt://127.0.0.1:9', username: '', password: '' });
    const ok = await c.ping();
    await c.close();
    expect(ok).toBe(false);
  });
});


describe('applyGraphSchema idempotency', () => {

  it('runs twice without throwing on duplicate constraint/index errors', async () => {

    const runMock = vi.fn().mockImplementation(async (stmt: string) => {
      // Simulate Memgraph: first call succeeds, second raises "already exists"
      if (runMock.mock.calls.length > 1 && stmt.startsWith('CREATE CONSTRAINT')) {
        throw new Error('Constraint already exists');
      }

      if (runMock.mock.calls.length > 1 && stmt.startsWith('CREATE INDEX')) {
        throw new Error('already exists — index is already created');
      }

      return [];
    });

    const fakeClient = { run: runMock } as unknown as GraphDbClient;

    await expect(applyGraphSchema(fakeClient)).resolves.toBeUndefined();
    await expect(applyGraphSchema(fakeClient)).resolves.toBeUndefined();
  });


  it('re-throws unexpected errors from Memgraph', async () => {

    const runMock = vi.fn().mockRejectedValue(new Error('Connection reset'));

    const fakeClient = { run: runMock } as unknown as GraphDbClient;

    await expect(applyGraphSchema(fakeClient)).rejects.toThrow('Connection reset');
  });
});
