import { NotFoundException } from '@nestjs/common';
import { GraphService } from './graph.service';


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
  };
  codeRepository: { deleteMany: ReturnType<typeof vi.fn> };
  graphSyncEvent: { create: ReturnType<typeof vi.fn> };
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
    architectureAnnotation: { create: vi.fn(), deleteMany: vi.fn() },
    codeRepository: { deleteMany: vi.fn() },
    graphSyncEvent: { create: vi.fn().mockResolvedValue({ id: 'evt' }) },
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
    resetProject: ReturnType<typeof vi.fn>;
  };
  let service: GraphService;

  beforeEach(() => {
    prisma = makePrisma();
    (globalThis as { __currentPrisma?: unknown }).__currentPrisma = prisma;
    sync = {
      upsertNode: vi.fn(),
      deleteNode: vi.fn(),
      upsertEdge: vi.fn(),
      deleteEdge: vi.fn(),
      resetProject: vi.fn(),
    };
    delete process.env.GRAPH_SYNC_USE_OUTBOX;
    service = new GraphService(prisma as never, sync as never);
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
      } as never, 'u1');

      expect(prisma.architectureNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ projectId: 'p1', type: 'app', name: 'web-app', isManual: true }),
      });
    });


    it('respects explicit isManual=false from DTO', async () => {
      prisma.architectureNode.create.mockResolvedValue({ id: 'n1' });

      await service.createNode('p1', { type: 'package', name: 'x', isManual: false } as never, 'u1');

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

      await expect(service.deleteNode('n1')).rejects.toThrow(/auto-generated/i);
      expect(prisma.architectureNode.delete).not.toHaveBeenCalled();
    });


    it('deletes a manual node', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', projectId: 'p1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.delete.mockResolvedValue({ id: 'n1' });

      await service.deleteNode('n1');

      expect(prisma.architectureNode.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });


    it('passes projectId to sync.deleteNode for multi-tenant scoping (CF-GDB-03a-3)', async () => {
      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', projectId: 'p1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.delete.mockResolvedValue({ id: 'n1' });

      await service.deleteNode('n1');

      expect(sync.deleteNode).toHaveBeenCalledWith('n1', 'p1');
    });
  });


  describe('updateNode', () => {

    it('mirrors updated fields to Memgraph via sync.upsertNode (CF-GDB-03a-1)', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue({ id: 'n1', isManual: true, annotations: [], links: [] });
      prisma.architectureNode.update.mockResolvedValue({
        id: 'n1', projectId: 'p1', type: 'package', name: 'renamed', path: '/x', domainGroup: 'core',
      });

      await service.updateNode('n1', { name: 'renamed' } as never);

      expect(sync.upsertNode).toHaveBeenCalledWith({
        id: 'n1', projectId: 'p1', type: 'package', name: 'renamed', path: '/x', domainGroup: 'core',
      });
    });
  });


  describe('deleteEdge passes projectId', () => {

    it('forwards edge.projectId to sync.deleteEdge (CF-GDB-03a-3)', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', projectId: 'p1', isManual: true });
      prisma.architectureEdge.delete.mockResolvedValue({ id: 'e1' });

      await service.deleteEdge('e1');

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
      return new GraphService(prisma as never, sync as never);
    }


    it('createNode emits a graphSyncEvent and skips inline sync', async () => {

      prisma.architectureNode.create.mockResolvedValue({
        id: 'n1', projectId: 'p1', type: 'package', name: 'x', path: null, domainGroup: null,
      });

      const svc = makeOutboxService();
      await svc.createNode('p1', { type: 'package', name: 'x' } as never, 'u1');

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
      await svc.deleteNode('n1');

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
      await svc.createEdge('p1', { fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on' } as never);

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
      await svc.createLink('n1', 'p1', { entityType: 'task', entityId: 't1', linkType: 'modifies' } as never, 'u1');

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
      await svc.createAnnotation('n1', 'p1', { content: 'hello' } as never, 'u1');

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


  describe('createEdge', () => {

    it('defaults weight to 1.0 and isManual to true', async () => {
      prisma.architectureEdge.create.mockResolvedValue({ id: 'e1' });

      await service.createEdge('p1', { fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on' } as never);

      expect(prisma.architectureEdge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ projectId: 'p1', weight: 1.0, isManual: true }),
      });
    });
  });


  describe('deleteEdge', () => {

    it('throws NotFoundException when edge not found', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue(null);

      await expect(service.deleteEdge('missing')).rejects.toBeInstanceOf(NotFoundException);
    });


    it('throws when trying to delete a non-manual edge', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', isManual: false });

      await expect(service.deleteEdge('e1')).rejects.toThrow(/auto-generated/i);
    });


    it('deletes a manual edge', async () => {
      prisma.architectureEdge.findUnique.mockResolvedValue({ id: 'e1', isManual: true });
      prisma.architectureEdge.delete.mockResolvedValue({ id: 'e1' });

      await service.deleteEdge('e1');

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
});
