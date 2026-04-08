import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@roadboard/database';


@Injectable()
export class AuditService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async record(
    actorType: string,
    actorId: string,
    eventType: string,
    targetType: string,
    targetId: string,
    projectId?: string,
    metadata?: Record<string, unknown>,
  ) {

    return this.prisma.activityEvent.create({
      data: {
        actorType,
        actorId,
        eventType,
        targetType,
        targetId,
        projectId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }


  async findByProject(projectId: string, take = 50, skip = 0) {

    const [events, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.activityEvent.count({ where: { projectId } }),
    ]);

    return { events, total, take, skip };
  }


  async findRecent(take = 20) {

    return this.prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
