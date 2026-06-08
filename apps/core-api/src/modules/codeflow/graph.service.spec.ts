import { NotFoundException } from '@nestjs/common';
import { GraphService } from './graph.service';
import type { AuthUser } from '../../common/auth-user';


const MOCK_USER: AuthUser = {
  userId: 'u1',
  username: 'tester',
  displayName: 'Tester',
  sessionId: 'sess',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  source: 'web',
};


interface PrismaMock {
  architectureSnapshot: { findFirst: ReturnType<typeof vi.fn> };
  codeRepository: { deleteMany: ReturnType<typeof vi.fn> };
  graphSyncEvent: {
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
}


function makePrisma(): PrismaMock {
  return {
    architectureSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    codeRepository: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    graphSyncEvent: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}


function makeGraph(runImpl?: (...args: unknown[]) => unknown) {
  return { run: runImpl ? vi.fn(runImpl) : vi.fn().mockResolvedValue([]) };
}


describe('GraphService (Memgraph single source of truth)', () => {

  let prisma: PrismaMock;
  let audit: { recordForUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = makePrisma();
    audit = { recordForUser: vi.fn().mockResolvedValue({ id: 'a' }) };
    delete process.env.GRAPH_SYNC_USE_OUTBOX;
  });


  afterEach(() => {
    delete process.env.GRAPH_SYNC_USE_OUTBOX;
  });


  function makeService(graph: { run: ReturnType<typeof vi.fn> }): GraphService {
    return new GraphService(prisma as never, audit as never, graph as never);
  }


  describe('requireGraph', () => {

    it('throws when no GraphDbClient is injected', async () => {
      const svc = new GraphService(prisma as never, audit as never);

      await expect(svc.getGraph('p1')).rejects.toThrow(/GraphDbClient is not available/);
    });
  });


  describe('createNode', () => {

    it('writes via Cypher MERGE, generates id, defaults isManual/isCurrent, audits', async () => {
      const graph = makeGraph();
      const svc = makeService(graph);

      const node = await svc.createNode('p1', {
        type: 'package', name: 'core', path: '/x', repositoryId: 'repo1',
      } as never, MOCK_USER) as { id: string; projectId: string; isManual: boolean; isCurrent: boolean };

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [cypher, params, opts] = graph.run.mock.calls[0];
      expect(cypher).toMatch(/MERGE \(n:Package \{id: \$id\}\)/);
      expect(opts).toEqual({ mode: 'write' });
      expect(params.id).toBeTruthy();
      expect(node.id).toBe(params.id);
      expect(node.projectId).toBe('p1');
      expect(node.isManual).toBe(true);
      expect(node.isCurrent).toBe(true);

      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'node.created', 'architecture_node', node.id, 'p1', expect.any(Object),
      );
    });


    it('respects explicit isManual=false from DTO', async () => {
      const graph = makeGraph();
      const svc = makeService(graph);

      const node = await svc.createNode('p1', {
        type: 'package', name: 'x', isManual: false,
      } as never, MOCK_USER) as { isManual: boolean };

      expect(node.isManual).toBe(false);
    });
  });


  describe('getNode', () => {

    it('returns node with annotations and links from Memgraph', async () => {
      const mgNode = {
        id: 'n1', projectId: 'p1', type: 'package', name: 'core',
        path: '/x', domainGroup: 'backend', description: 'd', metadata: null,
        ownerUserId: 'u1', ownerTeamId: null, isManual: true, isCurrent: true,
        links: [{ id: 'l1', projectId: 'p1', nodeId: 'n1', entityType: 'task', entityId: 't1', linkType: 'mentions', note: null }],
        annotations: [{ id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'hello' }],
      };
      const graph = makeGraph(() => Promise.resolve([mgNode]));
      const svc = makeService(graph);

      const result = await svc.getNode('n1') as { id: string; annotations: unknown[]; links: unknown[] };

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [, params, opts] = graph.run.mock.calls[0];
      expect(params).toEqual({ id: 'n1' });
      expect(opts).toEqual({ mode: 'read' });
      expect(result.id).toBe('n1');
      expect(result.annotations).toEqual(mgNode.annotations);
      expect(result.links).toEqual(mgNode.links);
    });


    it('throws NotFoundException when node not present in Memgraph', async () => {
      const graph = makeGraph(() => Promise.resolve([]));
      const svc = makeService(graph);

      await expect(svc.getNode('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });


  describe('updateNode', () => {

    it('updates via Cypher and audits the diff', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('SET n.name = coalesce')) {
          return Promise.resolve([{ id: 'n1', projectId: 'p1', name: 'renamed' }]);
        }

        // getNode read of existing
        return Promise.resolve([{
          id: 'n1', projectId: 'p1', name: 'old', description: null, domainGroup: null,
          ownerUserId: null, ownerTeamId: null, isManual: true, links: [], annotations: [],
        }]);
      });
      const svc = makeService(graph);

      await svc.updateNode('n1', { name: 'renamed' } as never, MOCK_USER);

      const writeCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('SET n.name = coalesce'));
      expect(writeCall).toBeDefined();
      expect(writeCall![2]).toEqual({ mode: 'write' });
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'node.updated', 'architecture_node', 'n1', 'p1', expect.any(Object),
      );
    });
  });


  describe('deleteNode', () => {

    it('throws when trying to delete a non-manual node', async () => {
      const graph = makeGraph(() => Promise.resolve([{ id: 'n1', projectId: 'p1', isManual: false, links: [], annotations: [] }]));
      const svc = makeService(graph);

      await expect(svc.deleteNode('n1', MOCK_USER)).rejects.toThrow(/auto-generated/i);
    });


    it('deletes a manual node via Cypher DETACH DELETE and audits', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('DETACH DELETE n')) {
          return Promise.resolve([]);
        }

        return Promise.resolve([{
          id: 'n1', projectId: 'p1', isManual: true, name: 'x', type: 'package', links: [], annotations: [],
        }]);
      });
      const svc = makeService(graph);

      await svc.deleteNode('n1', MOCK_USER);

      const deleteCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('DETACH DELETE n'));
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toEqual({ id: 'n1', pid: 'p1' });
      expect(deleteCall![2]).toEqual({ mode: 'write' });
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'node.deleted', 'architecture_node', 'n1', 'p1', expect.any(Object),
      );
    });
  });


  describe('createEdge', () => {

    it('writes via Cypher MERGE relationship and audits', async () => {
      const graph = makeGraph(() => Promise.resolve([{ created: 1 }]));
      const svc = makeService(graph);

      const edge = await svc.createEdge('p1', {
        fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on',
      } as never, MOCK_USER) as { id: string; fromNodeId: string; toNodeId: string; edgeType: string };

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [cypher, , opts] = graph.run.mock.calls[0];
      expect(cypher).toMatch(/MERGE \(a\)-\[r:DEPENDS_ON \{id: \$id\}\]->\(b\)/);
      expect(opts).toEqual({ mode: 'write' });
      expect(edge.fromNodeId).toBe('a');
      expect(edge.toNodeId).toBe('b');
      expect(edge.edgeType).toBe('depends_on');
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'edge.created', 'architecture_edge', edge.id, 'p1', expect.any(Object),
      );
    });


    it('defaults weight to 1.0 and isManual to true', async () => {
      const graph = makeGraph(() => Promise.resolve([{ created: 1 }]));
      const svc = makeService(graph);

      const edge = await svc.createEdge('p1', {
        fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on',
      } as never, MOCK_USER) as { weight: number; isManual: boolean };

      expect(edge.weight).toBe(1.0);
      expect(edge.isManual).toBe(true);
    });


    it('raises NotFoundException when a node endpoint is missing (Decision 7, no silent no-op)', async () => {
      const graph = makeGraph(() => Promise.resolve([{ created: 0 }]));
      const svc = makeService(graph);

      await expect(svc.createEdge('p1', {
        fromNodeId: 'a', toNodeId: 'missing', edgeType: 'depends_on',
      } as never, MOCK_USER)).rejects.toBeInstanceOf(NotFoundException);

      expect(audit.recordForUser).not.toHaveBeenCalled();
    });
  });


  describe('deleteEdge', () => {

    it('reads from Memgraph, deletes via Cypher, audits metadata', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('RETURN r.id AS id')) {
          return Promise.resolve([{
            id: 'e1', projectId: 'p1', fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on', isManual: true,
          }]);
        }

        return Promise.resolve([]);
      });
      const svc = makeService(graph);

      await svc.deleteEdge('e1', MOCK_USER);

      const deleteCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('DELETE r'));
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toEqual({ id: 'e1', pid: 'p1' });
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'edge.deleted', 'architecture_edge', 'e1', 'p1',
        expect.objectContaining({ fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on' }),
      );
    });


    it('raises NotFoundException when edge absent in Memgraph', async () => {
      const graph = makeGraph(() => Promise.resolve([]));
      const svc = makeService(graph);

      await expect(svc.deleteEdge('missing', MOCK_USER)).rejects.toBeInstanceOf(NotFoundException);
    });


    it('preserves the isManual guard via Memgraph read', async () => {
      const graph = makeGraph(() => Promise.resolve([{
        id: 'e1', projectId: 'p1', fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on', isManual: false,
      }]));
      const svc = makeService(graph);

      await expect(svc.deleteEdge('e1', MOCK_USER)).rejects.toThrow(/auto-generated/i);
    });
  });


  describe('createLink', () => {

    it('validates node via getNode, writes link via Cypher, audits', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('MERGE (l:Link')) {
          return Promise.resolve([]);
        }

        // getNode read
        return Promise.resolve([{ id: 'n1', projectId: 'p1', isManual: true, links: [], annotations: [] }]);
      });
      const svc = makeService(graph);

      const link = await svc.createLink('n1', 'p1', {
        entityType: 'task', entityId: 't1', linkType: 'mentions',
      } as never, MOCK_USER) as { id: string; nodeId: string };

      const writeCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('MERGE (l:Link'));
      expect(writeCall).toBeDefined();
      expect(writeCall![2]).toEqual({ mode: 'write' });
      expect(link.nodeId).toBe('n1');
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'link.created', 'architecture_link', link.id, 'p1', expect.any(Object),
      );
    });
  });


  describe('deleteLink', () => {

    it('reads link from Memgraph, deletes via Cypher, audits', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('MATCH (l:Link {id: $id})')) {
          return Promise.resolve([{
            id: 'l1', projectId: 'p1', nodeId: 'n1', entityType: 'task', entityId: 't1', linkType: 'mentions',
          }]);
        }

        return Promise.resolve([]);
      });
      const svc = makeService(graph);

      await svc.deleteLink('l1', MOCK_USER);

      const deleteCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('DETACH DELETE l'));
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toEqual({ id: 'l1', pid: 'p1' });
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'link.deleted', 'architecture_link', 'l1', 'p1', expect.any(Object),
      );
    });


    it('raises NotFoundException when link absent in Memgraph', async () => {
      const graph = makeGraph(() => Promise.resolve([]));
      const svc = makeService(graph);

      await expect(svc.deleteLink('missing', MOCK_USER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });


  describe('createAnnotation', () => {

    it('validates node via getNode, writes annotation via Cypher, audits', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('MERGE (a:Annotation')) {
          return Promise.resolve([]);
        }

        return Promise.resolve([{ id: 'n1', projectId: 'p1', isManual: true, links: [], annotations: [] }]);
      });
      const svc = makeService(graph);

      const ann = await svc.createAnnotation('n1', 'p1', { content: 'note' } as never, MOCK_USER) as { id: string; nodeId: string };

      const writeCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('MERGE (a:Annotation'));
      expect(writeCall).toBeDefined();
      expect(writeCall![2]).toEqual({ mode: 'write' });
      expect(ann.nodeId).toBe('n1');
      expect(audit.recordForUser).toHaveBeenCalledWith(
        MOCK_USER, 'annotation.created', 'architecture_annotation', ann.id, 'p1', expect.any(Object),
      );
    });
  });


  describe('resetProject', () => {

    it('counts then deletes graph entities via Cypher, cleans codeRepository in Postgres, returns exact counts', async () => {
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('RETURN nodeCount')) {
          return Promise.resolve([{ nodeCount: 4, edgeCount: 7 }]);
        }

        return Promise.resolve([]);
      });
      const svc = makeService(graph);

      const result = await svc.resetProject('p1') as { deletedNodes: number; deletedEdges: number };

      expect(result).toEqual({ deletedNodes: 4, deletedEdges: 7 });

      const deleteCall = graph.run.mock.calls.find((c) => (c[0] as string).includes('DETACH DELETE n'));
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toEqual({ pid: 'p1' });

      expect(prisma.codeRepository.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
    });
  });


  describe('getImpact', () => {

    it('classifies hops 1/2/3+ from the Memgraph reverse-BFS result', async () => {
      const triggerId = 'target';
      const graph = makeGraph((cypher: string) => {

        if ((cypher as string).includes('DEPENDS_ON')) {
          return Promise.resolve([
            { id: 'mid', type: 'package', name: 'mid', path: null, hopCount: 1 },
            { id: 'leaf1', type: 'package', name: 'leaf1', path: null, hopCount: 2 },
            { id: 'leaf2', type: 'package', name: 'leaf2', path: null, hopCount: 2 },
            { id: 'remote', type: 'package', name: 'remote', path: null, hopCount: 3 },
          ]);
        }

        // getNode read for trigger
        return Promise.resolve([{
          id: triggerId, type: 'app', name: 'target', path: null, isManual: false, links: [], annotations: [],
        }]);
      });
      const svc = makeService(graph);

      const result = await svc.getImpact(triggerId, 'p1') as {
        direct: { id: string }[];
        indirect: { id: string }[];
        remote: { id: string }[];
      };

      expect(result.direct.map((n) => n.id)).toEqual(['mid']);
      expect(result.indirect.map((n) => n.id).sort()).toEqual(['leaf1', 'leaf2']);
      expect(result.remote.map((n) => n.id)).toEqual(['remote']);
    });
  });


  describe('buildImpactCypher', () => {

    it('emits a reverse-BFS query with depth limit 10, self-loop guard, project scoping', () => {
      const svc = makeService(makeGraph());
      const cypher = svc.buildImpactCypher();

      expect(cypher).toMatch(/\(impacted\)-\[:DEPENDS_ON\s*\*1\.\.10\]->\(target\)/);
      expect(cypher).toMatch(/impacted\.id\s*<>\s*\$nodeId/);
      expect(cypher).toMatch(/impacted\.projectId\s*=\s*\$projectId/);
      expect(cypher).toMatch(/min\(size\(p\)\)\s+AS\s+hopCount/);
      expect(cypher).toMatch(/RETURN[\s\S]+hopCount/);
    });
  });


  describe('getGraph', () => {

    it('reads nodes/edges from Memgraph and snapshot metadata from Postgres', async () => {
      const nodeRows = [{
        id: 'n1', type: 'package', name: 'core', path: '/x', domainGroup: 'backend',
        isManual: true, ownerUserId: 'u1', ownerTeamId: null,
        metadata: '{"foo":"bar"}', taskCount: 2, decisionCount: 1, annotationCount: 3,
      }];
      const edgeRows = [{
        id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on', weight: 1, isManual: false,
      }];

      const graph = makeGraph();
      graph.run
        .mockResolvedValueOnce(nodeRows)
        .mockResolvedValueOnce(edgeRows);

      prisma.architectureSnapshot.findFirst.mockResolvedValue({
        id: 'snap1', status: 'completed', completedAt: new Date('2026-05-01T00:00:00.000Z'),
      });

      const svc = makeService(graph);
      const result = await svc.getGraph('p1') as {
        snapshotId: string | null;
        nodes: Array<{ id: string; openTaskCount: number; decisionCount: number; annotationCount: number; metadata: unknown }>;
        edges: Array<{ id: string }>;
      };

      expect(result.snapshotId).toBe('snap1');
      expect(result.nodes[0]).toMatchObject({ id: 'n1', openTaskCount: 2, decisionCount: 1, annotationCount: 3 });
      expect(result.nodes[0].metadata).toEqual({ foo: 'bar' });
      expect(result.edges).toEqual([{
        id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on', weight: 1, isManual: false,
      }]);
    });
  });


  describe('getSnapshot', () => {

    it('returns snapshot shape from Memgraph', async () => {
      const graph = makeGraph();
      graph.run
        .mockResolvedValueOnce([{ id: 'n1', type: 'app', name: 'web', path: null, domainGroup: null, linkCount: 1, annotationContents: ['note'] }])
        .mockResolvedValueOnce([{ fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on' }])
        .mockResolvedValueOnce([{ nodeId: 'n2', name: 'core', directDependants: 1 }]);

      const svc = makeService(graph);
      const result = await svc.getSnapshot('p1') as {
        projectId: string;
        nodeCount: number;
        edgeCount: number;
        nodes: Array<{ annotations: string[]; linkedDecisionCount: number }>;
        edges: Array<{ from: string; to: string; type: string }>;
        topImpactNodes: Array<{ nodeId: string; name: string; directDependants: number }>;
      };

      expect(result.projectId).toBe('p1');
      expect(result.nodeCount).toBe(1);
      expect(result.edgeCount).toBe(1);
      expect(result.nodes[0].annotations).toEqual(['note']);
      expect(result.nodes[0].linkedDecisionCount).toBe(1);
      expect(result.edges[0]).toEqual({ from: 'n1', to: 'n2', type: 'depends_on' });
      expect(result.topImpactNodes[0]).toEqual({ nodeId: 'n2', name: 'core', directDependants: 1 });
    });
  });


  describe('getSnapshotCompact', () => {

    it('aggregates nodes/edges/annotations and top-impact from Memgraph', async () => {
      const graph = makeGraph();
      graph.run
        // nodes
        .mockResolvedValueOnce([
          { id: 'n1', type: 'app', name: 'web-app' },
          { id: 'n2', type: 'package', name: 'domain' },
          { id: 'n3', type: 'app', name: 'core-api' },
        ])
        // edges
        .mockResolvedValueOnce([
          { fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on' },
          { fromNodeId: 'n3', toNodeId: 'n2', edgeType: 'depends_on' },
          { fromNodeId: 'n1', toNodeId: 'n3', edgeType: 'depends_on' },
        ])
        // annotations
        .mockResolvedValueOnce([
          { nodeId: 'n1', content: 'Primary frontend', createdAt: '2026-05-01T00:00:00.000Z', nodeName: 'web-app' },
        ])
        // computeTopImpactNodesFromMemgraph
        .mockResolvedValueOnce([
          { nodeId: 'n2', name: 'domain', type: 'package', directDependants: 2 },
          { nodeId: 'n3', name: 'core-api', type: 'app', directDependants: 1 },
        ]);

      const svc = makeService(graph);
      const result = await svc.getSnapshotCompact('p1');

      expect(result.projectId).toBe('p1');
      expect(result.nodeCount).toBe(3);
      expect(result.edgeCount).toBe(3);
      expect(result.summary.nodesByType).toEqual({ app: 2, package: 1 });
      expect(result.summary.edgesByType).toEqual({ depends_on: 3 });
      expect(result.topImpactNodes[0]).toMatchObject({ nodeId: 'n2', directDependants: 2 });
      expect(result.recentAnnotations).toHaveLength(1);
      expect(result.recentAnnotations[0]).toMatchObject({
        nodeId: 'n1', nodeName: 'web-app', content: 'Primary frontend', createdAt: '2026-05-01T00:00:00.000Z',
      });
    });
  });


  describe('listEntityLinks', () => {

    it('returns empty payload when no links match', async () => {
      const graph = makeGraph(() => Promise.resolve([]));
      const svc = makeService(graph);

      const result = await svc.listEntityLinks('p1', 'task', 't1');

      expect(result).toEqual({ links: [], nodes: [] });
    });
  });


  describe('getOutboxStats', () => {

    it('aggregates pending/in_progress/dead counts plus oldest pending and done windows', async () => {
      const oldestDate = new Date('2026-04-25T19:00:00.000Z');
      prisma.graphSyncEvent.count
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(120);
      prisma.graphSyncEvent.findFirst.mockResolvedValueOnce({ createdAt: oldestDate });

      const svc = makeService(makeGraph());
      const stats = await svc.getOutboxStats();

      expect(stats).toEqual({
        enabled: false,
        pending: 7,
        inProgress: 1,
        dead: 2,
        pendingOldestAt: '2026-04-25T19:00:00.000Z',
        doneLast1h: 40,
        doneLast24h: 120,
      });
    });
  });
});
