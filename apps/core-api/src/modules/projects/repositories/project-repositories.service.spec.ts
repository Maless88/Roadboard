import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRepositoriesService } from './project-repositories.service';
import { CodeRepositoryProvider } from '@roadboard/domain';
import { NotFoundException } from '@nestjs/common';


const mockPrisma = {
  codeRepository: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};


describe('ProjectRepositoriesService', () => {

  let service: ProjectRepositoriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectRepositoriesService(mockPrisma as never);
  });


  describe('list', () => {

    it('returns repos for project', async () => {

      const rows = [{ id: 'r1', projectId: 'p1' }];
      mockPrisma.codeRepository.findMany.mockResolvedValueOnce(rows);

      const result = await service.list('p1');

      expect(result).toEqual(rows);
      expect(mockPrisma.codeRepository.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });


  describe('create', () => {

    it('derives name from URL when name is absent', async () => {

      const dto = {
        provider: CodeRepositoryProvider.GITHUB,
        repoUrl: 'https://github.com/acme/my-repo',
      };

      mockPrisma.codeRepository.create.mockResolvedValueOnce({ id: 'r1', name: 'my-repo' });

      await service.create('p1', dto);

      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'my-repo' }),
      });
    });


    it('strips .git suffix when deriving name', async () => {

      const dto = {
        provider: CodeRepositoryProvider.GITLAB,
        repoUrl: 'https://gitlab.com/group/sub/project.git',
      };

      mockPrisma.codeRepository.create.mockResolvedValueOnce({ id: 'r2', name: 'project' });

      await service.create('p1', dto);

      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'project' }),
      });
    });


    it('uses provided name when given', async () => {

      const dto = {
        provider: CodeRepositoryProvider.BITBUCKET,
        repoUrl: 'https://bitbucket.org/team/repo',
        name: 'custom-name',
      };

      mockPrisma.codeRepository.create.mockResolvedValueOnce({ id: 'r3', name: 'custom-name' });

      await service.create('p1', dto);

      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'custom-name' }),
      });
    });


    it('defaults branch to main', async () => {

      const dto = {
        provider: CodeRepositoryProvider.GITHUB,
        repoUrl: 'https://github.com/acme/repo',
      };

      mockPrisma.codeRepository.create.mockResolvedValueOnce({ id: 'r4' });

      await service.create('p1', dto);

      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ defaultBranch: 'main' }),
      });
    });
  });


  describe('update', () => {

    it('throws NotFoundException when repo not in project', async () => {

      mockPrisma.codeRepository.findFirst.mockResolvedValueOnce(null);

      await expect(service.update('missing', 'p1', {})).rejects.toThrow(NotFoundException);
    });


    it('updates existing repo', async () => {

      mockPrisma.codeRepository.findFirst.mockResolvedValueOnce({ id: 'r1' });
      mockPrisma.codeRepository.update.mockResolvedValueOnce({ id: 'r1', name: 'updated' });

      const result = await service.update('r1', 'p1', { name: 'updated' });

      expect(result).toEqual({ id: 'r1', name: 'updated' });
    });
  });


  describe('remove', () => {

    it('throws NotFoundException when repo not in project', async () => {

      mockPrisma.codeRepository.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove('missing', 'p1')).rejects.toThrow(NotFoundException);
    });


    it('deletes existing repo', async () => {

      mockPrisma.codeRepository.findFirst.mockResolvedValueOnce({ id: 'r1' });
      mockPrisma.codeRepository.delete.mockResolvedValueOnce({ id: 'r1' });

      const result = await service.remove('r1', 'p1');

      expect(result).toEqual({ id: 'r1' });
    });
  });
});
