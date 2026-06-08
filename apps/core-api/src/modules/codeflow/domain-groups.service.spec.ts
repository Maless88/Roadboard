import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DomainGroupsService } from './domain-groups.service';
import { CreateDomainGroupDto } from './dto/create-domain-group.dto';
import { UpdateDomainGroupDto } from './dto/update-domain-group.dto';


const PROJECT_ID = 'project-1';
const GROUP_ID = 'group-1';
const NODE_ID = 'node-1';


function makePrismaMock() {

  return {
    domainGroup: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}


describe('DomainGroupsService', () => {

  let svc: DomainGroupsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let graph: { run: ReturnType<typeof vi.fn> };

  beforeEach(async () => {

    prisma = makePrismaMock();
    graph = { run: vi.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        DomainGroupsService,
        { provide: 'PRISMA', useValue: prisma },
        { provide: 'GRAPH_DB_CLIENT', useValue: graph },
      ],
    }).compile();

    svc = module.get(DomainGroupsService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create', () => {

    it('creates a domain group', async () => {

      const dto: CreateDomainGroupDto = { name: 'Auth', color: '#6366f1' };
      const expected = { id: GROUP_ID, projectId: PROJECT_ID, ...dto };
      prisma.domainGroup.create.mockResolvedValue(expected);

      const result = await svc.create(PROJECT_ID, dto);

      expect(prisma.domainGroup.create).toHaveBeenCalledWith({
        data: { projectId: PROJECT_ID, name: 'Auth', color: '#6366f1' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('list', () => {

    it('returns groups ordered by createdAt', async () => {

      const groups = [{ id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth' }];
      prisma.domainGroup.findMany.mockResolvedValue(groups);

      const result = await svc.list(PROJECT_ID);

      expect(prisma.domainGroup.findMany).toHaveBeenCalledWith({
        where: { projectId: PROJECT_ID },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(groups);
    });
  });

  describe('update', () => {

    it('updates an existing group', async () => {

      const existing = { id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth', color: null };
      prisma.domainGroup.findUnique.mockResolvedValue(existing);
      const dto: UpdateDomainGroupDto = { name: 'Identity' };
      const updated = { ...existing, name: 'Identity' };
      prisma.domainGroup.update.mockResolvedValue(updated);

      const result = await svc.update(PROJECT_ID, GROUP_ID, dto);

      expect(prisma.domainGroup.update).toHaveBeenCalledWith({
        where: { id: GROUP_ID },
        data: { name: 'Identity', color: undefined },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when group does not exist', async () => {

      prisma.domainGroup.findUnique.mockResolvedValue(null);

      await expect(svc.update(PROJECT_ID, GROUP_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {

    it('clears the domainGroup name on Memgraph nodes via Cypher, deletes group via Prisma', async () => {

      const existing = { id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth' };
      prisma.domainGroup.findUnique.mockResolvedValue(existing);
      prisma.domainGroup.delete.mockResolvedValue(existing);

      await svc.remove(PROJECT_ID, GROUP_ID);

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [cypher, params, opts] = graph.run.mock.calls[0];
      expect(cypher).toMatch(/SET n\.domainGroup = null/);
      expect(params).toEqual({ projectId: PROJECT_ID, name: 'Auth' });
      expect(opts).toEqual({ mode: 'write' });
      expect(prisma.domainGroup.delete).toHaveBeenCalledWith({ where: { id: GROUP_ID } });
    });
  });

  describe('assignNode', () => {

    it('assigns by setting the group name on the Memgraph node', async () => {

      const group = { id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth' };
      prisma.domainGroup.findUnique.mockResolvedValue(group);
      graph.run.mockResolvedValue([{ id: NODE_ID }]);

      await svc.assignNode(PROJECT_ID, NODE_ID, GROUP_ID);

      expect(graph.run).toHaveBeenCalledTimes(1);
      const [cypher, params, opts] = graph.run.mock.calls[0];
      expect(cypher).toMatch(/SET n\.domainGroup = \$groupName/);
      expect(params).toEqual({ nodeId: NODE_ID, projectId: PROJECT_ID, groupName: 'Auth' });
      expect(opts).toEqual({ mode: 'write' });
    });


    it('unassigns by setting the group name to null', async () => {

      graph.run.mockResolvedValue([{ id: NODE_ID }]);

      await svc.assignNode(PROJECT_ID, NODE_ID, null);

      const [, params] = graph.run.mock.calls[0];
      expect(params).toEqual({ nodeId: NODE_ID, projectId: PROJECT_ID, groupName: null });
    });


    it('raises NotFoundException when the Memgraph node does not exist', async () => {

      graph.run.mockResolvedValue([]);

      await expect(svc.assignNode(PROJECT_ID, NODE_ID, null)).rejects.toThrow(NotFoundException);
    });
  });
});
