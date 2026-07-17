import { describe, expect, it, vi } from 'vitest';
import { DashboardsService } from './dashboards.service';


describe('DashboardsService', () => {

  it('returns urgentTasksTotal from count, not from the limited urgent task page', async () => {
    const urgentPage = Array.from({ length: 10 }, (_, index) => ({
      id: `task-${index}`,
      title: `Urgent ${index}`,
      status: 'todo',
      priority: index === 0 ? 'critical' : 'high',
    }));
    const prisma = {
      task: {
        groupBy: vi.fn().mockResolvedValue([
          { status: 'todo', _count: { id: 12 } },
        ]),
        findMany: vi.fn().mockResolvedValue(urgentPage),
        count: vi.fn().mockResolvedValue(12),
      },
      phase: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      memoryEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      decision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new DashboardsService(prisma as never);

    const snapshot = await service.getSnapshot('project-1');

    expect(snapshot.urgentTasks).toHaveLength(10);
    expect(snapshot.urgentTasksTotal).toBe(12);
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: { in: ['todo', 'in_progress', 'blocked'] },
        priority: { in: ['high', 'critical'] },
      },
    });
  });
});
