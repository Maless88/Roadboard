import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';


@Injectable()
export class DashboardsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async getSnapshot(projectId: string) {

    const [
      tasksByStatus,
      milestonesByStatus,
      activePhases,
      recentMemory,
      recentDecisions,
      urgentTasks,
    ] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.milestone.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.phase.findMany({
        where: { projectId, status: 'in_progress' },
        select: { id: true, title: true, status: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.memoryEntry.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, title: true, createdAt: true },
      }),
      this.prisma.decision.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, status: true, impactLevel: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: {
          projectId,
          status: { in: ['todo', 'in_progress', 'blocked'] },
          priority: { in: ['high', 'critical'] },
        },
        select: { id: true, title: true, status: true, priority: true },
        orderBy: { priority: 'desc' },
        take: 10,
      }),
    ]);

    const taskSummary: Record<string, number> = {};

    for (const row of tasksByStatus) {
      taskSummary[row.status] = row._count.id;
    }

    const milestoneSummary: Record<string, number> = {};

    for (const row of milestonesByStatus) {
      milestoneSummary[row.status] = row._count.id;
    }

    return {
      projectId,
      tasks: taskSummary,
      milestones: milestoneSummary,
      activePhases,
      recentMemory,
      recentDecisions,
      urgentTasks,
    };
  }


  async getTasksSummary(projectId: string) {

    const rows = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    });

    const summary: Record<string, number> = {};

    for (const row of rows) {
      summary[row.status] = row._count.id;
    }

    return { projectId, tasks: summary };
  }


  async getMilestoneProgress(projectId: string) {

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      select: { id: true, title: true, status: true, dueDate: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    });

    const total = milestones.length;
    const completed = milestones.filter(m => m.status === 'completed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      projectId,
      total,
      completed,
      percent,
      milestones,
    };
  }
}
