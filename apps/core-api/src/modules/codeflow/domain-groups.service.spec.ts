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
    architectureNode: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}


describe('DomainGroupsService', () => {

  let svc: DomainGroupsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {

    prisma = makePrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        DomainGroupsService,
        { provide: 'PRISMA', useValue: prisma },
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

    it('unsets nodes and deletes the group', async () => {

      const existing = { id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth' };
      prisma.domainGroup.findUnique.mockResolvedValue(existing);
      prisma.architectureNode.updateMany.mockResolvedValue({ count: 2 });
      prisma.domainGroup.delete.mockResolvedValue(existing);

      await svc.remove(PROJECT_ID, GROUP_ID);

      expect(prisma.architectureNode.updateMany).toHaveBeenCalledWith({
        where: { domainGroupId: GROUP_ID, projectId: PROJECT_ID },
        data: { domainGroupId: null },
      });
      expect(prisma.domainGroup.delete).toHaveBeenCalledWith({ where: { id: GROUP_ID } });
    });
  });

  describe('assignNode', () => {

    it('assigns a node to a group', async () => {

      const node = { id: NODE_ID, projectId: PROJECT_ID };
      const group = { id: GROUP_ID, projectId: PROJECT_ID, name: 'Auth' };
      prisma.architectureNode.findUnique.mockResolvedValue(node);
      prisma.domainGroup.findUnique.mockResolvedValue(group);
      prisma.architectureNode.update.mockResolvedValue({ ...node, domainGroupId: GROUP_ID });

      await svc.assignNode(PROJECT_ID, NODE_ID, GROUP_ID);

      expect(prisma.architectureNode.update).toHaveBeenCalledWith({
        where: { id: NODE_ID },
        data: { domainGroupId: GROUP_ID },
      });
    });

    it('unassigns a node (null groupId)', async () => {

      const node = { id: NODE_ID, projectId: PROJECT_ID };
      prisma.architectureNode.findUnique.mockResolvedValue(node);
      prisma.architectureNode.update.mockResolvedValue({ ...node, domainGroupId: null });

      await svc.assignNode(PROJECT_ID, NODE_ID, null);

      expect(prisma.architectureNode.update).toHaveBeenCalledWith({
        where: { id: NODE_ID },
        data: { domainGroupId: null },
      });
    });

    it('throws NotFoundException when node does not exist', async () => {

      prisma.architectureNode.findUnique.mockResolvedValue(null);

      await expect(svc.assignNode(PROJECT_ID, NODE_ID, null)).rejects.toThrow(NotFoundException);
    });
  });
});
