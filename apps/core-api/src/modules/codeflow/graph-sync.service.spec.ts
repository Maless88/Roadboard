import { GraphSyncService } from './graph-sync.service';


function makeService(opts: { runImpl: () => Promise<unknown>; pingImpl?: () => Promise<boolean> }): {
  service: GraphSyncService;
  warnSpy: ReturnType<typeof vi.fn>;
} {

  const client = {
    ping: opts.pingImpl ?? (async () => true),
    run: vi.fn(opts.runImpl),
    close: vi.fn(async () => undefined),
  } as unknown as ConstructorParameters<typeof GraphSyncService>[0];

  const service = new GraphSyncService(client);
  const warnSpy = vi.fn();
  // Replace the private logger with a spy. Casting because logger is private.
  (service as unknown as { logger: { warn: typeof warnSpy } }).logger = { warn: warnSpy };
  // Force enabled: the production gate runs in onModuleInit which we skip.
  (service as unknown as { enabled: boolean }).enabled = true;

  return { service, warnSpy };
}


describe('GraphSyncService', () => {

  describe('structured warn on failures (CF-GDB-03a-4)', () => {

    it('upsertNode emits a structured warn payload', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('memgraph down'); },
      });

      await service.upsertNode({
        id: 'n1', projectId: 'p1', type: 'package', name: 'x', path: null, domainGroup: null,
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const payload = warnSpy.mock.calls[0][0];
      expect(payload).toMatchObject({
        op: 'upsertNode',
        projectId: 'p1',
        entityType: 'node',
        entityId: 'n1',
        error: 'memgraph down',
      });
    });


    it('deleteNode emits structured warn including projectId (multi-tenant)', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('boom'); },
      });

      await service.deleteNode('n1', 'p1');

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'deleteNode',
        projectId: 'p1',
        entityType: 'node',
        entityId: 'n1',
        error: 'boom',
      }));
    });


    it('upsertEdge emits structured warn', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('cypher syntax'); },
      });

      await service.upsertEdge({
        id: 'e1', projectId: 'p1', fromNodeId: 'a', toNodeId: 'b', edgeType: 'depends_on', weight: 1,
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'upsertEdge',
        projectId: 'p1',
        entityType: 'edge',
        entityId: 'e1',
      }));
    });


    it('deleteEdge emits structured warn including projectId (multi-tenant)', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('boom'); },
      });

      await service.deleteEdge('e1', 'p1');

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'deleteEdge',
        projectId: 'p1',
        entityType: 'edge',
        entityId: 'e1',
      }));
    });


    it('resetProject emits structured warn with entityType=project', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('netfail'); },
      });

      await service.resetProject('p1');

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'resetProject',
        projectId: 'p1',
        entityType: 'project',
        entityId: 'p1',
      }));
    });
  });


  describe('multi-tenant scoped Cypher (CF-GDB-03a-3)', () => {

    it('deleteNode runs MATCH (n {id, projectId}) DETACH DELETE', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.deleteNode('n1', 'p1');

      expect(receivedCypher).toContain('id: $id');
      expect(receivedCypher).toContain('projectId: $pid');
      expect(receivedCypher).toContain('DETACH DELETE');
      expect(receivedParams).toEqual({ id: 'n1', pid: 'p1' });
    });


    it('deleteEdge runs MATCH ()-[r {id, projectId}]->() DELETE', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.deleteEdge('e1', 'p1');

      expect(receivedCypher).toContain('id: $id');
      expect(receivedCypher).toContain('projectId: $pid');
      expect(receivedCypher).toContain('DELETE r');
      expect(receivedParams).toEqual({ id: 'e1', pid: 'p1' });
    });
  });
});
