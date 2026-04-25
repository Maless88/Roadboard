import { DriftService } from './drift.service';


function makePrisma(rows: Record<string, { id: string }[]>) {
  return {
    architectureNode: { findMany: vi.fn().mockResolvedValue(rows.nodes ?? []) },
    architectureEdge: { findMany: vi.fn().mockResolvedValue(rows.edges ?? []) },
    architectureLink: { findMany: vi.fn().mockResolvedValue(rows.links ?? []) },
    architectureAnnotation: { findMany: vi.fn().mockResolvedValue(rows.annotations ?? []) },
    codeRepository: { findMany: vi.fn().mockResolvedValue(rows.repositories ?? []) },
  };
}


function makeGraph(rows: Record<string, { id: string }[]>, options: { reachable?: boolean } = {}) {

  const reachable = options.reachable !== false;
  return {
    ping: vi.fn(async () => reachable),
    run: vi.fn(async (cypher: string) => {
      // Pick the right bucket from the Cypher shape — order matters since
      // the node query contains 'WHERE NOT n:Link' so we must check the
      // edge / typed-MATCH patterns first.
      if (cypher.startsWith('MATCH ()-[r]->()')) return rows.edges ?? [];
      if (cypher.includes('MATCH (l:Link)')) return rows.links ?? [];
      if (cypher.includes('MATCH (a:Annotation)')) return rows.annotations ?? [];
      if (cypher.includes('MATCH (r:Repository)')) return rows.repositories ?? [];
      return rows.nodes ?? [];
    }),
  };
}


describe('DriftService', () => {

  it('reports reachable=false when graph client is missing', async () => {

    const svc = new DriftService(makePrisma({}) as never);
    const report = await svc.detectDrift();

    expect(report.reachable).toBe(false);
    expect(report.entities).toHaveLength(0);
    expect(report.totalDrift).toBe(0);
  });


  it('reports reachable=false when ping fails', async () => {

    const graph = makeGraph({}, { reachable: false });
    const svc = new DriftService(makePrisma({}) as never, graph as never);

    const report = await svc.detectDrift();

    expect(report.reachable).toBe(false);
  });


  it('reports inSync=true when Postgres and Memgraph match perfectly', async () => {

    const sharedRows = {
      nodes: [{ id: 'n1' }, { id: 'n2' }],
      edges: [{ id: 'e1' }],
      links: [{ id: 'l1' }],
      annotations: [{ id: 'a1' }],
      repositories: [{ id: 'r1' }],
    };
    const svc = new DriftService(
      makePrisma(sharedRows) as never,
      makeGraph(sharedRows) as never,
    );

    const report = await svc.detectDrift();

    expect(report.reachable).toBe(true);
    expect(report.totalDrift).toBe(0);
    expect(report.entities.every((e) => e.inSync)).toBe(true);
  });


  it('detects missing-in-memgraph for nodes', async () => {

    const svc = new DriftService(
      makePrisma({ nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }] }) as never,
      makeGraph({ nodes: [{ id: 'n1' }] }) as never,
    );

    const report = await svc.detectDrift();
    const nodeReport = report.entities.find((e) => e.type === 'node');

    expect(nodeReport?.inSync).toBe(false);
    expect(nodeReport?.postgresCount).toBe(3);
    expect(nodeReport?.memgraphCount).toBe(1);
    expect(nodeReport?.missingInMemgraph.sort()).toEqual(['n2', 'n3']);
    expect(nodeReport?.extraInMemgraph).toEqual([]);
    expect(report.totalDrift).toBe(1);
  });


  it('detects extra-in-memgraph (orphan in projection)', async () => {

    const svc = new DriftService(
      makePrisma({ links: [{ id: 'l1' }] }) as never,
      makeGraph({ links: [{ id: 'l1' }, { id: 'l2_orphan' }] }) as never,
    );

    const report = await svc.detectDrift();
    const linkReport = report.entities.find((e) => e.type === 'link');

    expect(linkReport?.inSync).toBe(false);
    expect(linkReport?.extraInMemgraph).toEqual(['l2_orphan']);
    expect(linkReport?.missingInMemgraph).toEqual([]);
  });


  it('caps missing/extra arrays at 5 elements', async () => {

    const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id_${i}` }));
    const svc = new DriftService(
      makePrisma({ nodes: ids(20) }) as never,
      makeGraph({ nodes: [] }) as never,
    );

    const report = await svc.detectDrift();
    const nodeReport = report.entities.find((e) => e.type === 'node');

    expect(nodeReport?.missingInMemgraph).toHaveLength(5);
    expect(nodeReport?.postgresCount).toBe(20);
  });


  it('totalDrift counts each out-of-sync entity once', async () => {

    const svc = new DriftService(
      makePrisma({
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1' }],
        links: [{ id: 'l1' }],
        annotations: [{ id: 'a1' }],
        repositories: [{ id: 'r1' }],
      }) as never,
      makeGraph({
        nodes: [],            // drift
        edges: [{ id: 'e1' }],
        links: [],            // drift
        annotations: [{ id: 'a1' }],
        repositories: [],     // drift
      }) as never,
    );

    const report = await svc.detectDrift();
    expect(report.totalDrift).toBe(3);
  });
});
