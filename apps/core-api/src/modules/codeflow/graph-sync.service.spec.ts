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


    it('upsertLink emits structured warn', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('cypher err'); },
      });

      await service.upsertLink({
        id: 'l1', projectId: 'p1', nodeId: 'n1',
        entityType: 'task', entityId: 't1', linkType: 'mentions', note: null,
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'upsertLink',
        projectId: 'p1',
        entityType: 'link',
        entityId: 'l1',
      }));
    });


    it('deleteLink emits structured warn including projectId (multi-tenant)', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('boom'); },
      });

      await service.deleteLink('l1', 'p1');

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'deleteLink',
        projectId: 'p1',
        entityType: 'link',
        entityId: 'l1',
      }));
    });


    it('upsertAnnotation emits structured warn', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('cypher err'); },
      });

      await service.upsertAnnotation({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'note',
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'upsertAnnotation',
        projectId: 'p1',
        entityType: 'annotation',
        entityId: 'a1',
      }));
    });


    it('deleteAnnotation emits structured warn including projectId (multi-tenant)', async () => {

      const { service, warnSpy } = makeService({
        runImpl: async () => { throw new Error('boom'); },
      });

      await service.deleteAnnotation('a1', 'p1');

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
        op: 'deleteAnnotation',
        projectId: 'p1',
        entityType: 'annotation',
        entityId: 'a1',
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


    it('deleteLink runs MATCH (l:Link {id, projectId}) DETACH DELETE', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.deleteLink('l1', 'p1');

      expect(receivedCypher).toContain('l:Link');
      expect(receivedCypher).toContain('id: $id');
      expect(receivedCypher).toContain('projectId: $pid');
      expect(receivedCypher).toContain('DETACH DELETE');
      expect(receivedParams).toEqual({ id: 'l1', pid: 'p1' });
    });


    it('deleteAnnotation runs MATCH (a:Annotation {id, projectId}) DETACH DELETE', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.deleteAnnotation('a1', 'p1');

      expect(receivedCypher).toContain('a:Annotation');
      expect(receivedCypher).toContain('id: $id');
      expect(receivedCypher).toContain('projectId: $pid');
      expect(receivedCypher).toContain('DETACH DELETE');
      expect(receivedParams).toEqual({ id: 'a1', pid: 'p1' });
    });
  });


  describe('mirror shape (CF-GDB-03b-A)', () => {

    it('upsertNode writes extended fields (description/metadata/owner/isManual/isCurrent)', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.upsertNode({
        id: 'n1', projectId: 'p1', type: 'package', name: 'core', path: 'apps/core',
        domainGroup: 'backend', description: 'descr', metadata: { foo: 'bar' },
        ownerUserId: 'u1', ownerTeamId: 't1', isManual: true, isCurrent: true,
      });

      expect(receivedCypher).toContain('n.description = $description');
      expect(receivedCypher).toContain('n.metadata = $metadata');
      expect(receivedCypher).toContain('n.ownerUserId = $ownerUserId');
      expect(receivedCypher).toContain('n.ownerTeamId = $ownerTeamId');
      expect(receivedCypher).toContain('n.isManual = $isManual');
      expect(receivedCypher).toContain('n.isCurrent = $isCurrent');
      expect(receivedParams).toMatchObject({
        description: 'descr',
        ownerUserId: 'u1',
        ownerTeamId: 't1',
        isManual: true,
        isCurrent: true,
      });
      // metadata is serialized to JSON string (Memgraph properties accept primitives / strings).
      expect(receivedParams.metadata).toBe('{"foo":"bar"}');
    });


    it('upsertLink runs MERGE (l:Link) and LINKED_TO relationship', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.upsertLink({
        id: 'l1', projectId: 'p1', nodeId: 'n1',
        entityType: 'task', entityId: 't1', linkType: 'mentions', note: 'hello',
      });

      expect(receivedCypher).toContain('MERGE (l:Link');
      expect(receivedCypher).toContain(':LINKED_TO');
      expect(receivedParams).toMatchObject({
        id: 'l1', projectId: 'p1', nodeId: 'n1',
        entityType: 'task', entityId: 't1', linkType: 'mentions', note: 'hello',
      });
    });


    it('upsertAnnotation runs MERGE (a:Annotation) and ANNOTATES relationship', async () => {

      let receivedCypher = '';
      let receivedParams: Record<string, unknown> = {};
      const { service } = makeService({
        runImpl: async function (this: unknown, cypher: string, params: Record<string, unknown>) {
          receivedCypher = cypher;
          receivedParams = params;
          return undefined;
        } as never,
      });

      await service.upsertAnnotation({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'note',
      });

      expect(receivedCypher).toContain('MERGE (a:Annotation');
      expect(receivedCypher).toContain(':ANNOTATES');
      expect(receivedParams).toMatchObject({
        id: 'a1', projectId: 'p1', nodeId: 'n1', content: 'note',
      });
    });
  });
});
