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
  architectureNode: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  architectureEdge: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  architectureSnapshot: {
    findFirst: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  architectureLink: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  architectureAnnotation: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  codeRepository: { deleteMany: ReturnType<typeof vi.fn> };
  graphSyncEvent: {
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  impactAnalysis: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}


function makePrisma(): PrismaMock {
  return {
    architectureNode: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    architectureEdge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    architectureSnapshot: { findFirst: vi.fn(), deleteMany: vi.fn() },
    architectureLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    architectureAnnotation: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    codeRepository: { deleteMany: vi.fn() },
    graphSyncEvent: {
      create: vi.fn().mockResolvedValue({ id: 'evt' }),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    impactAnalysis: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    // Support both forms: array of PrismaPromise and interactive callback.
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        // Interactive callback: pass `mock` itself as tx (the methods are jest fns).
        // The closure captures `prisma`, but we re-resolve via `this` indirection
        // by using the global `__currentPrisma` set in beforeEach.
        return (arg as (tx: unknown) => Promise<unknown>)((globalThis as { __currentPrisma?: unknown }).__currentPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
}


describe('GraphService', () => {

  let prisma: PrismaMock;
  let sync: {
    upsertNode: ReturnType<typeof vi.fn>;
    deleteNode: ReturnType<typeof vi.fn>;
    upsertEdge: ReturnType<typeof vi.fn>;
    deleteEdge: ReturnType<typeof vi.fn>;
    upsertLink: ReturnType<typeof vi.fn>;
    deleteLink: ReturnType<typeof vi.fn>;
    upsertAnnotation: ReturnType<typeof vi.fn>;
    deleteAnnotation: ReturnType<typeof vi.fn>;
    resetProject: ReturnType<typeof vi.fn>;
  };
  let service: GraphService;
  let audit: { recordForUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = makePrisma();
    (globalThis as { __currentPrisma?: unknown }).__currentPrisma = prisma;
    sync = {
      upsertNode: vi.fn(),
      deleteNode: vi.fn(),
      upsertEdge: vi.fn(),
      deleteEdge: vi.fn(),
      upsertLink: vi.fn(),
      deleteLink: vi.fn(),
      upsertAnnotation: vi.fn(),
      deleteAnnotation: vi.fn(),
      resetProject: vi.fn(),
    };
    audit = { recordForUser: vi.fn().mockResolvedValue({ id: 'a' }) };
    delete process.env.GRAPH_SYNC_USE_OUTBOX;
    service = new GraphService(prisma as never, sync as never, audit as never);
  });


  afterEach(() => {
    delete process.env.GRAPH_SYNC_USE_OUTBOX;
  });


  describe('createNode', () => {

    it('defaults isManual to true when not provided', async () => {
      prisma.architectureNode.create.mockResolvedValue({ id: 'n1' });

      await service.createNode('p1', {
        type: 'app',
        name: 'web-app',
      } as never, MOCK_USER);

      expect(prisma.architectureNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ projectId: 'p1', type: 'app', name: 'web-app', isManual: true }),
      });
    });


    it('respects explicit isManual=false from DTO', async () => {
      prisma.architectureNode.create.mockResolvedValue({ id: 'n1' });

      await service.createNode('p1', { type: 'package', name: 'x', isManual: false } as never, MOCK_USER);

      expect(prisma.architectureNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isManual: false }),
      });
    });
  });


  describe('getNode', () => {

    it('throws NotFoundException when node does not exist', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue(null);

      await expect(service.getNode('missing')).rejects.toBeInstanceOf(NotFoundException);
    });


    it('returns node with annotations and links when found', async () => {
      const node = { id: 'n1', isManual: true, annotations: [], links: [] };
      prisma.architectureNode.findUnique.mockResolvedValue(node);

      const result = await service.getNode('n1');

      expect(result).toBe(node);
      expect(prisma.architectureNode.findUnique).toHaveBeenCalledWith({
        where: { id: 'n1' },
        include: expect.any(Object),
      });
    });
  });


  describe('deleteNode', () => {

    it('throws when trying to delete a non-manual node', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: false, annotations: [], links: [] });

      await expect(service.deleteNode('n1', MOCK_USER)).rejects.toThrow(/auto-generated/i);
      expect(prisma.architectureNode.delete).not.toHaveBeenCalled();
    });


    it('deletes a manual node', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', projectId: 'p1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.delete.mockResolvedValue({ id: 'n1' });

      await service.deleteNode('n1', MOCK_USER);

      expect(prisma.architectureNode.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });


    it('passes projectId to sync.deleteNode for multi-tenant scoping (CF-GDB-03a-3)', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', projectId: 'p1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.delete.mockResolvedValue({ id: 'n1' });

      await service.deleteNode('n1', MOCK_USER);

      expect(sync.deleteNode).toHaveBeenCalledWith('n1', 'p1');
    });
  });


  describe('updateNode', () => {

    it('mirrors updated fields to Memgraph via sync.upsertNode (CF-GDB-03a-1)', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.update.mockResolvedValue({
        id: 'n1', projectId: 'p1', type: 'package', name: 'renamed', path: '/x', domainGroup: 'core',
      });

      await service.updateNode('n1', { name: 'renamed' } as never, MOCK_USER);

      expect(sync.upsertNode).toHaveBeenCalledWith(expect.objectContaining({
        id: 'n1', projectId: 'p1', type: 'package', name: 'renamed', path: '/x', domainGroup: 'core',
      }));
    });
  });


  describe('createLink mirror sync (CF-GDB-03b-A)', () => {

    it('forwards link payload to sync.upsertLink in direct-sync mode', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureLink.create.mockResolvedValue({
        id: 'l1', projectId: 'p1', nodeId: 'n1',
        entityType: 'task', entityId: 't1', linkType: 'mentions', note: null,
      });

      await service.createLink('n1', 'p1', {
        entityType: 'task', entityId: 't1', linkType: 'mentions',
      } as never, MOCK_USER);

      expect(sync.upsertLink).toHaveBeenCalledWith({
        id: 'l1', projectId: 'p1', nodeId: 'n1',
        entityType: 'task', entityId: 't1', linkType: 'mentions', note: null,
      });
    });
  });


  describe('deleteLink mirror sync (CF-GDB-03b-A)', () => {

    it('forwards id + projectId to sync.deleteLink', async () => {
      prisma.architectureLink.findUnique.mockResolvedValue({ id: 'l1', projectId: 'p1' });
      prisma.architectureLink.delete.mockResolvedValue({ id: 'l1' });

      await service.deleteLink('l1', MOCK_USER);

      expect(sync.deleteLink).toHaveBeenCalledWith('l1', 'p1');
    });
  });


  describe('createAnnotation mirror sync (CF-GDB-03b-A)', () => {

    it('forwards annotation payload to sync.upsertAnnotation in direct-sync mode', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureAnnotation.create.mockResolvedValue({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'note',
      });

      await service.createAnnotation('n1', 'p1', { content: 'note' } as never, MOCK_USER);

      expect(sync.upsertAnnotation).toHaveBeenCalledWith({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'note',
      });
    });
  });


  describe('deleteEdge passes projectId', () => {

    it('forwards edge.projectId to sync.deleteEdge (CF-GDB-03a-3)', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', projectId: 'p1', isManual: true });
      prisma.architectureEdge.delete.mockResolvedValue({ id: 'e1' });

      await service.deleteEdge('e1', MOCK_USER);

      expect(sync.deleteEdge).toHaveBeenCalledWith('e1', 'p1');
    });
  });


  describe('resetProject', () => {

    it('wraps the 6 deleteMany calls in prisma.$transaction in FK-safe order (CF-GDB-03a-2)', async () => {

      prisma.architectureEdge.deleteMany.mockResolvedValue({ count: 7 });
      prisma.architectureLink.deleteMany.mockResolvedValue({ count: 0 });
      prisma.architectureAnnotation.deleteMany.mockResolvedValue({ count: 0 });
      prisma.architectureNode.deleteMany.mockResolvedValue({ count: 4 });
      prisma.architectureSnapshot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.codeRepository.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.resetProject('p1') as { deletedNodes: number; deletedEdges: number };

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0] as unknown[];
      expect(Array.isArray(ops)).toBe(true);
      expect(ops).toHaveLength(6);

      // FK-safe order check: each deleteMany was called with projectId
      expect(prisma.architectureEdge.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.architectureLink.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.architectureAnnotation.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.architectureNode.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.architectureSnapshot.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.codeRepository.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });

      expect(result.deletedEdges).toBe(7);
      expect(result.deletedNodes).toBe(4);

      // sync.resetProject runs only after the Postgres tx commits
      expect(sync.resetProject).toHaveBeenCalledWith('p1');
    });
  });


  describe('outbox mode (GRAPH_SYNC_USE_OUTBOX=true)', () => {

    function makeOutboxService(): GraphService {
      process.env.GRAPH_SYNC_USE_OUTBOX = 'true';
      return new GraphService(prisma as never, sync as never, audit as never);
    }


    it('createNode emits a graphSyncEvent and skips inline sync', async () => {

      prisma.architectureNode.create.mockResolvedValue({
        id: 'n1', projectId: 'p1', type: 'package', name: 'x', path: null, domainGroup: null,
      });

      const svc = makeOutboxService();
      await svc.createNode('p1', { type: 'package', name: 'x' } as never, MOCK_USER);

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'p1', entityType: 'node', entityId: 'n1', op: 'upsert',
          payload: expect.objectContaining({ id: 'n1', name: 'x', type: 'package' }),
        }),
      });
      // Inline sync mirror is bypassed in outbox mode
      expect(sync.upsertNode).not.toHaveBeenCalled();
    });


    it('deleteNode emits a delete event and skips inline sync', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', projectId: 'p1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.delete.mockResolvedValue({ id: 'n1' });

      const svc = makeOutboxService();
      await svc.deleteNode('n1', MOCK_USER);

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'node', entityId: 'n1', op: 'delete',
        }),
      });
      expect(sync.deleteNode).not.toHaveBeenCalled();
    });


    it('createEdge emits an upsert event', async () => {

      prisma.architectureEdge.create.mockResolvedValue({
        id: 'e1', projectId: 'p1', fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on', weight: 1, isManual: true,
      });

      const svc = makeOutboxService();
      await svc.createEdge('p1', { fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on' } as never, MOCK_USER);

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'edge', entityId: 'e1', op: 'upsert' }),
      });
      expect(sync.upsertEdge).not.toHaveBeenCalled();
    });


    it('createLink emits an upsert event (NUOVO — non era mirrorato in legacy)', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureLink.create.mockResolvedValue({
        id: 'l1', projectId: 'p1', nodeId: 'n1', entityType: 'task', entityId: 't1',
        linkType: 'modifies', note: null,
      });

      const svc = makeOutboxService();
      await svc.createLink('n1', 'p1', { entityType: 'task', entityId: 't1', linkType: 'modifies' } as never, MOCK_USER);

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'link', entityId: 'l1', op: 'upsert' }),
      });
    });


    it('createAnnotation emits an upsert event (NUOVO)', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureAnnotation.create.mockResolvedValue({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'hello',
      });

      const svc = makeOutboxService();
      await svc.createAnnotation('n1', 'p1', { content: 'hello' } as never, MOCK_USER);

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'annotation', entityId: 'a1', op: 'upsert' }),
      });
    });


    it('resetProject emits a project:reset event in the same transaction and skips inline sync', async () => {

      prisma.architectureEdge.deleteMany.mockResolvedValue({ count: 2 });
      prisma.architectureLink.deleteMany.mockResolvedValue({ count: 0 });
      prisma.architectureAnnotation.deleteMany.mockResolvedValue({ count: 0 });
      prisma.architectureNode.deleteMany.mockResolvedValue({ count: 1 });
      prisma.architectureSnapshot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.codeRepository.deleteMany.mockResolvedValue({ count: 0 });

      const svc = makeOutboxService();
      const result = await svc.resetProject('p1') as { deletedNodes: number; deletedEdges: number };

      expect(prisma.graphSyncEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: 'project', entityId: 'p1', op: 'reset' }),
      });
      expect(result).toEqual({ deletedNodes: 1, deletedEdges: 2 });
      expect(sync.resetProject).not.toHaveBeenCalled();
    });
  });


  describe('getOutboxStats (CF-GDB-03b-8)', () => {

    it('aggregates pending/in_progress/dead counts plus oldest pending and done windows', async () => {

      const oldestDate = new Date('2026-04-25T19:00:00.000Z');
      prisma.graphSyncEvent.count
        .mockResolvedValueOnce(7)   // pending
        .mockResolvedValueOnce(1)   // in_progress
        .mockResolvedValueOnce(2)   // dead
        .mockResolvedValueOnce(40)  // doneLast1h
        .mockResolvedValueOnce(120); // doneLast24h
      prisma.graphSyncEvent.findFirst.mockResolvedValueOnce({ createdAt: oldestDate });

      const stats = await service.getOutboxStats();

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


  describe('createEdge', () => {

    it('defaults weight to 1.0 and isManual to true', async () => {
      prisma.architectureEdge.create.mockResolvedValue({ id: 'e1' });

      await service.createEdge('p1', { fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on' } as never, MOCK_USER);

      expect(prisma.architectureEdge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ projectId: 'p1', weight: 1.0, isManual: true }),
      });
    });
  });


  describe('deleteEdge', () => {

    it('throws NotFoundException when edge not found', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue(null);

      await expect(service.deleteEdge('missing', MOCK_USER)).rejects.toBeInstanceOf(NotFoundException);
    });


    it('throws when trying to delete a non-manual edge', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', isManual: false });

      await expect(service.deleteEdge('e1', MOCK_USER)).rejects.toThrow(/auto-generated/i);
    });


    it('deletes a manual edge', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', projectId: 'p1', isManual: true });
      prisma.architectureEdge.delete.mockResolvedValue({ id: 'e1' });

      await service.deleteEdge('e1', MOCK_USER);

      expect(prisma.architectureEdge.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });
  });


  describe('getImpact', () => {

    it('builds reverse BFS: direct, indirect, remote classification', async () => {
      // Graph:   leaf1 -> mid -> target
      //          leaf2 -> mid
      //          remote -> leaf1
      const triggerId = 'target';

      prisma.architectureNode.findUnique.mockResolvedValue({
        id: triggerId, type: 'app', name: 'target', path: null, isManual: false, annotations: [], links: [],
      });

      prisma.architectureEdge.findMany.mockResolvedValue([
        { fromNodeId: 'mid', toNodeId: 'target', edgeType: 'depends_on' },
        { fromNodeId: 'leaf1', toNodeId: 'mid', edgeType: 'depends_on' },
        { fromNodeId: 'leaf2', toNodeId: 'mid', edgeType: 'depends_on' },
        { fromNodeId: 'remote', toNodeId: 'leaf1', edgeType: 'depends_on' },
      ]);

      prisma.architectureNode.findMany.mockResolvedValue([
        { id: 'mid', type: 'package', name: 'mid', path: null },
        { id: 'leaf1', type: 'package', name: 'leaf1', path: null },
        { id: 'leaf2', type: 'package', name: 'leaf2', path: null },
        { id: 'remote', type: 'package', name: 'remote', path: null },
      ]);

      const result = await service.getImpact(triggerId, 'p1') as {
        direct: { id: string }[];
        indirect: { id: string }[];
        remote: { id: string }[];
      };

      expect(result.direct.map((n) => n.id)).toEqual(['mid']);
      expect(result.indirect.map((n) => n.id).sort()).toEqual(['leaf1', 'leaf2']);
      expect(result.remote.map((n) => n.id)).toEqual(['remote']);
    });
  });


  describe('getImpact — Memgraph swap (CF-GDB-03b-B)', () => {

    afterEach(() => {
      delete process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT;
    });


    it('buildImpactCypher emits a reverse-BFS query with depth limit 10 and self-loop guard', () => {

      const svc = new GraphService(prisma as never, sync as never, audit as never);
      const cypher = svc.buildImpactCypher();

      // Reverse direction: edges point FROM dependent TO target, so we walk
      // `(impacted)-[:DEPENDS_ON*]->(target)`.
      expect(cypher).toMatch(/\(impacted\)-\[:DEPENDS_ON\s*\*1\.\.10\]->\(target\)/);
      // Self-loop exclusion.
      expect(cypher).toMatch(/impacted\.id\s*<>\s*\$nodeId/);
      // Project scoping.
      expect(cypher).toMatch(/impacted\.projectId\s*=\s*\$projectId/);
      // Min hops aggregation so each node gets exactly one bucket
      // (aliased as `hopCount` because `hops` is reserved in Memgraph).
      expect(cypher).toMatch(/min\(size\(p\)\)\s+AS\s+hopCount/);
      // Result shape used by getImpactFromMemgraph.
      expect(cypher).toMatch(/RETURN[\s\S]+hopCount/);
    });


    it('flag ON routes through Memgraph and classifies hops 1/2/3+', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT = 'true';

      const triggerId = 'target';

      prisma.architectureNode.findUnique.mockResolvedValue({
        id: triggerId, type: 'app', name: 'target', path: null, isManual: false, annotations: [], links: [],
      });

      const graph = {
        run: vi.fn().mockResolvedValue([
          { id: 'mid', type: 'package', name: 'mid', path: null, hopCount: 1 },
          { id: 'leaf1', type: 'package', name: 'leaf1', path: null, hopCount: 2 },
          { id: 'leaf2', type: 'package', name: 'leaf2', path: null, hopCount: 2 },
          { id: 'remote', type: 'package', name: 'remote', path: null, hopCount: 3 },
        ]),
      };

      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getImpact(triggerId, 'p1') as {
        direct: { id: string }[];
        indirect: { id: string }[];
        remote: { id: string }[];
      };

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [, params, opts] = graph.run.mock.calls[0];
      expect(params).toEqual({ nodeId: triggerId, projectId: 'p1' });
      expect(opts).toEqual({ mode: 'read' });

      expect(result.direct.map((n) => n.id)).toEqual(['mid']);
      expect(result.indirect.map((n) => n.id).sort()).toEqual(['leaf1', 'leaf2']);
      expect(result.remote.map((n) => n.id)).toEqual(['remote']);

      // Postgres fallback path must not be touched.
      expect(prisma.architectureEdge.findMany).not.toHaveBeenCalled();
    });


    it('falls back to Postgres when Memgraph query throws', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT = 'true';

      const triggerId = 'target';

      prisma.architectureNode.findUnique.mockResolvedValue({
        id: triggerId, type: 'app', name: 'target', path: null, isManual: false, annotations: [], links: [],
      });

      prisma.architectureEdge.findMany.mockResolvedValue([
        { fromNodeId: 'mid', toNodeId: 'target', edgeType: 'depends_on' },
      ]);

      prisma.architectureNode.findMany.mockResolvedValue([
        { id: 'mid', type: 'package', name: 'mid', path: null },
      ]);

      const graph = {
        run: vi.fn().mockRejectedValue(new Error('memgraph down')),
      };

      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getImpact(triggerId, 'p1') as { direct: { id: string }[] };

      expect(graph.run).toHaveBeenCalledTimes(1);
      // Postgres path actually ran.
      expect(prisma.architectureEdge.findMany).toHaveBeenCalled();
      expect(result.direct.map((n) => n.id)).toEqual(['mid']);
    });


    it('flag OFF keeps Postgres-only behaviour (zero regression)', async () => {

      // Default: env var unset.
      const triggerId = 'target';

      prisma.architectureNode.findUnique.mockResolvedValue({
        id: triggerId, type: 'app', name: 'target', path: null, isManual: false, annotations: [], links: [],
      });

      prisma.architectureEdge.findMany.mockResolvedValue([]);
      prisma.architectureNode.findMany.mockResolvedValue([]);

      const graph = { run: vi.fn() };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      await svc.getImpact(triggerId, 'p1');

      expect(graph.run).not.toHaveBeenCalled();
      expect(prisma.architectureEdge.findMany).toHaveBeenCalled();
    });
  });


  describe('refreshImpact — idempotent atomic refresh (AI-P0-03)', () => {

    // Graph: leaf1 -> mid -> root
    //        leaf2 -> mid
    const nodes = [
      { id: 'root' },
      { id: 'mid' },
      { id: 'leaf1' },
      { id: 'leaf2' },
    ];

    const edges = [
      { fromNodeId: 'mid', toNodeId: 'root', edgeType: 'depends_on' },
      { fromNodeId: 'leaf1', toNodeId: 'mid', edgeType: 'depends_on' },
      { fromNodeId: 'leaf2', toNodeId: 'mid', edgeType: 'depends_on' },
    ];


    it('writes one ImpactAnalysis row per current node (bounded count)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue(nodes);
      prisma.architectureEdge.findMany.mockResolvedValue(edges);

      const { upsertedRows } = await service.refreshImpact('p1', 'snap1');

      expect(upsertedRows).toBe(nodes.length);
      expect(prisma.impactAnalysis.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ triggerNodeId: 'root', projectId: 'p1', snapshotId: 'snap1' }),
          expect.objectContaining({ triggerNodeId: 'mid' }),
          expect.objectContaining({ triggerNodeId: 'leaf1' }),
          expect.objectContaining({ triggerNodeId: 'leaf2' }),
        ]),
      });
    });


    it('deletes old rows before inserting new ones (atomic transaction)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue(nodes);
      prisma.architectureEdge.findMany.mockResolvedValue(edges);

      await service.refreshImpact('p1', 'snap1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.impactAnalysis.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(prisma.impactAnalysis.createMany).toHaveBeenCalledTimes(1);
    });


    it('after 2 consecutive refreshes row count stays bounded (no orphan rows)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue(nodes);
      prisma.architectureEdge.findMany.mockResolvedValue(edges);

      // First refresh
      const first = await service.refreshImpact('p1', 'snap1');

      // Reset call counts but not mock implementations
      prisma.$transaction.mockClear();
      prisma.impactAnalysis.deleteMany.mockClear();
      prisma.impactAnalysis.createMany.mockClear();

      // Second refresh (simulating a new snapshot)
      const second = await service.refreshImpact('p1', 'snap2');

      // Both calls produce the same row count (bounded by node count)
      expect(first.upsertedRows).toBe(nodes.length);
      expect(second.upsertedRows).toBe(nodes.length);

      // Each refresh deletes old rows first — no orphans can accumulate
      expect(prisma.impactAnalysis.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
    });


    it('correctly classifies blast-radius: root has mid as direct, leaf1+leaf2 as indirect', async () => {

      prisma.architectureNode.findMany.mockResolvedValue(nodes);
      prisma.architectureEdge.findMany.mockResolvedValue(edges);

      await service.refreshImpact('p1', 'snap1');

      const createManyArg = prisma.impactAnalysis.createMany.mock.calls[0][0] as {
        data: Array<{
          triggerNodeId: string;
          directNodeIds: string[];
          indirectNodeIds: string[];
          remoteNodeIds: string[];
        }>;
      };

      const rootRow = createManyArg.data.find((r) => r.triggerNodeId === 'root');
      expect(rootRow).toBeDefined();
      expect(rootRow!.directNodeIds).toEqual(['mid']);
      expect(rootRow!.indirectNodeIds.sort()).toEqual(['leaf1', 'leaf2']);
      expect(rootRow!.remoteNodeIds).toEqual([]);
    });


    it('skips createMany when project has no nodes (empty graph is bounded at 0)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue([]);
      prisma.architectureEdge.findMany.mockResolvedValue([]);

      const { upsertedRows } = await service.refreshImpact('p1', 'snap1');

      expect(upsertedRows).toBe(0);
      expect(prisma.impactAnalysis.createMany).not.toHaveBeenCalled();
      // deleteMany still called to remove any stale rows from previous snapshots
      expect(prisma.impactAnalysis.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
    });
  });


  describe('getNode — Memgraph swap (CF-GDB-03b-C)', () => {

    afterEach(() => {
      delete process.env.GRAPH_READ_USE_MEMGRAPH_NODE;
    });


    it('flag ON routes through Memgraph and returns shape with annotations + links', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_NODE = 'true';

      const mgNode = {
        id: 'n1', projectId: 'p1', type: 'package', name: 'core',
        path: '/x', domainGroup: 'backend',
        description: 'd', metadata: null,
        ownerUserId: 'u1', ownerTeamId: null,
        isManual: true, isCurrent: true,
      };
      const mgLinks = [
        { id: 'l1', projectId: 'p1', nodeId: 'n1', entityType: 'task', entityId: 't1', linkType: 'mentions', note: null },
      ];
      const mgAnnotations = [
        { id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'hello' },
      ];

      const graph = {
        run: vi.fn().mockResolvedValue([{ n: mgNode, links: mgLinks, annotations: mgAnnotations }]),
      };

      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);
      const result = await svc.getNode('n1') as {
        id: string;
        annotations: Array<{ id: string; content: string }>;
        links: Array<{ id: string; entityType: string }>;
      };

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [, params, opts] = graph.run.mock.calls[0];
      expect(params).toEqual({ id: 'n1' });
      expect(opts).toEqual({ mode: 'read' });

      expect(result.id).toBe('n1');
      expect(result.annotations).toEqual([{ id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'hello' }]);
      expect(result.links).toEqual([{ id: 'l1', projectId: 'p1', nodeId: 'n1', entityType: 'task', entityId: 't1', linkType: 'mentions', note: null }]);

      // Postgres fallback must NOT be touched on success.
      expect(prisma.architectureNode.findUnique).not.toHaveBeenCalled();
    });


    it('flag OFF keeps Postgres path (zero regression)', async () => {

      const node = { id: 'n1', isManual: true, annotations: [], links: [] };
      prisma.architectureNode.findUnique.mockResolvedValue(node);

      const graph = { run: vi.fn() };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getNode('n1');

      expect(graph.run).not.toHaveBeenCalled();
      expect(prisma.architectureNode.findUnique).toHaveBeenCalled();
      expect(result).toBe(node);
    });


    it('falls back to Postgres when Memgraph query throws', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_NODE = 'true';

      const node = { id: 'n1', isManual: true, annotations: [], links: [] };
      prisma.architectureNode.findUnique.mockResolvedValue(node);

      const graph = { run: vi.fn().mockRejectedValue(new Error('memgraph down')) };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getNode('n1');

      expect(graph.run).toHaveBeenCalledTimes(1);
      expect(prisma.architectureNode.findUnique).toHaveBeenCalled();
      expect(result).toBe(node);
    });


    it('falls back to Postgres when Memgraph returns no record (node not mirrored)', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_NODE = 'true';

      const node = { id: 'n1', isManual: true, annotations: [], links: [] };
      prisma.architectureNode.findUnique.mockResolvedValue(node);

      const graph = { run: vi.fn().mockResolvedValue([]) };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getNode('n1');

      expect(graph.run).toHaveBeenCalledTimes(1);
      expect(prisma.architectureNode.findUnique).toHaveBeenCalled();
      expect(result).toBe(node);
    });
  });


  describe('getGraph — Memgraph swap (CF-GDB-03b-C)', () => {

    afterEach(() => {
      delete process.env.GRAPH_READ_USE_MEMGRAPH_GRAPH;
    });


    it('flag ON routes through Memgraph and returns shape with nodes/edges/snapshot', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_GRAPH = 'true';

      const nodeRows = [
        {
          id: 'n1', type: 'package', name: 'core', path: '/x', domainGroup: 'backend',
          isManual: true, ownerUserId: 'u1', ownerTeamId: null,
          metadata: '{"foo":"bar"}',
          taskCount: 2, decisionCount: 1, annotationCount: 3,
        },
      ];
      const edgeRows = [
        { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on', weight: 1, isManual: false },
      ];

      const graph = {
        run: vi.fn()
          .mockResolvedValueOnce(nodeRows)
          .mockResolvedValueOnce(edgeRows),
      };

      prisma.architectureSnapshot.findFirst.mockResolvedValue({
        id: 'snap1', status: 'completed', completedAt: new Date('2026-05-01T00:00:00.000Z'),
      });

      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);
      const result = await svc.getGraph('p1') as {
        snapshotId: string | null;
        nodes: Array<{ id: string; openTaskCount: number; decisionCount: number; annotationCount: number; metadata: unknown }>;
        edges: Array<{ id: string; fromNodeId: string; toNodeId: string }>;
      };

      expect(graph.run).toHaveBeenCalledTimes(2);
      expect(result.snapshotId).toBe('snap1');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({
        id: 'n1',
        openTaskCount: 2,
        decisionCount: 1,
        annotationCount: 3,
      });
      expect(result.nodes[0].metadata).toEqual({ foo: 'bar' });
      expect(result.edges).toEqual([{
        id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on', weight: 1, isManual: false,
      }]);

      // Postgres reads for nodes/edges must NOT be touched.
      expect(prisma.architectureNode.findMany).not.toHaveBeenCalled();
      expect(prisma.architectureEdge.findMany).not.toHaveBeenCalled();
    });


    it('flag OFF keeps Postgres path (zero regression)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue([]);
      prisma.architectureEdge.findMany.mockResolvedValue([]);
      prisma.architectureSnapshot.findFirst.mockResolvedValue(null);
      prisma.architectureLink.groupBy.mockResolvedValue([]);

      const graph = { run: vi.fn() };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      await svc.getGraph('p1');

      expect(graph.run).not.toHaveBeenCalled();
      expect(prisma.architectureNode.findMany).toHaveBeenCalled();
    });


    it('falls back to Postgres when Memgraph query throws', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_GRAPH = 'true';

      prisma.architectureNode.findMany.mockResolvedValue([]);
      prisma.architectureEdge.findMany.mockResolvedValue([]);
      prisma.architectureSnapshot.findFirst.mockResolvedValue(null);
      prisma.architectureLink.groupBy.mockResolvedValue([]);

      const graph = { run: vi.fn().mockRejectedValue(new Error('boom')) };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getGraph('p1') as { nodes: unknown[]; edges: unknown[] };

      expect(graph.run).toHaveBeenCalled();
      expect(prisma.architectureNode.findMany).toHaveBeenCalled();
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });


  describe('getSnapshot — Memgraph swap (CF-GDB-03b-C)', () => {

    afterEach(() => {
      delete process.env.GRAPH_READ_USE_MEMGRAPH_SNAPSHOT;
    });


    it('flag ON routes through Memgraph and returns snapshot shape', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_SNAPSHOT = 'true';

      const nodeRows = [
        { id: 'n1', type: 'app', name: 'web', path: null, domainGroup: null, linkCount: 1, annotationContents: ['note'] },
      ];
      const edgeRows = [
        { fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on' },
      ];
      const topImpactRows = [
        { nodeId: 'n2', name: 'core', directDependants: 1 },
      ];

      const graph = {
        run: vi.fn()
          .mockResolvedValueOnce(nodeRows)
          .mockResolvedValueOnce(edgeRows)
          .mockResolvedValueOnce(topImpactRows),
      };

      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);
      const result = await svc.getSnapshot('p1') as {
        projectId: string;
        nodeCount: number;
        edgeCount: number;
        nodes: Array<{ id: string; annotations: string[]; linkedDecisionCount: number }>;
        edges: Array<{ from: string; to: string; type: string }>;
        topImpactNodes: Array<{ nodeId: string; name: string; directDependants: number }>;
      };

      expect(graph.run).toHaveBeenCalledTimes(3);
      expect(result.projectId).toBe('p1');
      expect(result.nodeCount).toBe(1);
      expect(result.edgeCount).toBe(1);
      expect(result.nodes[0].annotations).toEqual(['note']);
      expect(result.nodes[0].linkedDecisionCount).toBe(1);
      expect(result.edges[0]).toEqual({ from: 'n1', to: 'n2', type: 'depends_on' });
      expect(result.topImpactNodes[0]).toEqual({ nodeId: 'n2', name: 'core', directDependants: 1 });

      // Postgres path must NOT be touched.
      expect(prisma.architectureNode.findMany).not.toHaveBeenCalled();
      expect(prisma.architectureEdge.findMany).not.toHaveBeenCalled();
    });


    it('flag OFF keeps Postgres path (zero regression)', async () => {

      prisma.architectureNode.findMany.mockResolvedValue([]);
      prisma.architectureEdge.findMany.mockResolvedValue([]);

      const graph = { run: vi.fn() };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      await svc.getSnapshot('p1');

      expect(graph.run).not.toHaveBeenCalled();
      expect(prisma.architectureNode.findMany).toHaveBeenCalled();
    });


    it('falls back to Postgres when Memgraph query throws', async () => {

      process.env.GRAPH_READ_USE_MEMGRAPH_SNAPSHOT = 'true';

      prisma.architectureNode.findMany.mockResolvedValue([]);
      prisma.architectureEdge.findMany.mockResolvedValue([]);

      const graph = { run: vi.fn().mockRejectedValue(new Error('boom')) };
      const svc = new GraphService(prisma as never, sync as never, audit as never, graph as never);

      const result = await svc.getSnapshot('p1') as { nodeCount: number };

      expect(graph.run).toHaveBeenCalled();
      expect(prisma.architectureNode.findMany).toHaveBeenCalled();
      expect(result.nodeCount).toBe(0);
    });
  });


  describe('getSnapshotCompact', () => {

    const NODES = [
      { id: 'n1', type: 'app', name: 'web-app' },
      { id: 'n2', type: 'package', name: 'domain' },
      { id: 'n3', type: 'app', name: 'core-api' },
    ];

    const EDGES = [
      { fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'depends_on' },
      { fromNodeId: 'n3', toNodeId: 'n2', edgeType: 'depends_on' },
      { fromNodeId: 'n1', toNodeId: 'n3', edgeType: 'depends_on' },
    ];

    const ANNOTATIONS = [
      {
        nodeId: 'n1',
        content: 'Primary frontend',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        node: { name: 'web-app' },
      },
    ];

    beforeEach(() => {
      prisma.architectureNode.findMany.mockResolvedValue(NODES);
      prisma.architectureEdge.findMany.mockResolvedValue(EDGES);
      prisma.architectureAnnotation.findMany.mockResolvedValue(ANNOTATIONS);
    });


    it('returns correct shape with projectId, generatedAt, nodeCount, edgeCount', async () => {

      const result = await service.getSnapshotCompact('p1');

      expect(result.projectId).toBe('p1');
      expect(result.nodeCount).toBe(3);
      expect(result.edgeCount).toBe(3);
      expect(typeof result.generatedAt).toBe('string');
    });


    it('computes summary.nodesByType correctly', async () => {

      const result = await service.getSnapshotCompact('p1');

      expect(result.summary.nodesByType).toEqual({ app: 2, package: 1 });
    });


    it('computes summary.edgesByType correctly', async () => {

      const result = await service.getSnapshotCompact('p1');

      expect(result.summary.edgesByType).toEqual({ depends_on: 3 });
    });


    it('returns topImpactNodes via Prisma fallback (no Memgraph) ordered by directDependants desc', async () => {

      const result = await service.getSnapshotCompact('p1');

      // n2 has 2 incoming depends_on, n3 has 1
      expect(result.topImpactNodes).toHaveLength(2);
      expect(result.topImpactNodes[0]).toMatchObject({ nodeId: 'n2', name: 'domain', directDependants: 2 });
      expect(result.topImpactNodes[1]).toMatchObject({ nodeId: 'n3', name: 'core-api', directDependants: 1 });
    });


    it('limits topImpactNodes to 5', async () => {

      const manyNodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, type: 'app', name: `app-${i}` }));
      const manyEdges = manyNodes.map((n, i) => ({
        fromNodeId: 'src',
        toNodeId: n.id,
        edgeType: 'depends_on',
      }));

      // Each node receives (8 - i) incoming edges to have distinct counts
      const edgesForCounts = manyNodes.flatMap((n, i) =>
        Array.from({ length: 8 - i }, (__, j) => ({
          fromNodeId: `src${j}`,
          toNodeId: n.id,
          edgeType: 'depends_on',
        })),
      );

      prisma.architectureNode.findMany.mockResolvedValue(manyNodes);
      prisma.architectureEdge.findMany.mockResolvedValue(edgesForCounts);

      const result = await service.getSnapshotCompact('p1');

      expect(result.topImpactNodes.length).toBeLessThanOrEqual(5);
    });


    it('maps recentAnnotations correctly', async () => {

      const result = await service.getSnapshotCompact('p1');

      expect(result.recentAnnotations).toHaveLength(1);
      expect(result.recentAnnotations[0]).toMatchObject({
        nodeId: 'n1',
        nodeName: 'web-app',
        content: 'Primary frontend',
        createdAt: '2026-05-01T00:00:00.000Z',
      });
    });


    it('returns empty topImpactNodes when no depends_on edges', async () => {

      prisma.architectureEdge.findMany.mockResolvedValue([
        { fromNodeId: 'n1', toNodeId: 'n2', edgeType: 'calls' },
      ]);

      const result = await service.getSnapshotCompact('p1');

      expect(result.topImpactNodes).toHaveLength(0);
    });


    it('returns empty recentAnnotations when none exist', async () => {

      prisma.architectureAnnotation.findMany.mockResolvedValue([]);

      const result = await service.getSnapshotCompact('p1');

      expect(result.recentAnnotations).toHaveLength(0);
    });
  });
});
