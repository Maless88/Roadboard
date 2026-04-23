import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@roadboard/database';
import type { AuthUser } from '../../common/auth-user';


const ACTOR_INCLUDE = {
  actor: {
    select: { id: true, username: true, displayName: true },
  },
} as const;


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
    actorUserId?: string | null,
    source?: string,
  ) {

    return this.prisma.activityEvent.create({
      data: {
        actorType,
        actorId,
        actorUserId: actorUserId ?? null,
        source: source ?? 'system',
        eventType,
        targetType,
        targetId,
        projectId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }


  async recordForUser(
    user: AuthUser,
    eventType: string,
    targetType: string,
    targetId: string,
    projectId?: string,
    metadata?: Record<string, unknown>,
  ) {

    return this.record(
      'user',
      user.userId,
      eventType,
      targetType,
      targetId,
      projectId,
      metadata,
      user.userId,
      user.source,
    );
  }


  async findByProject(
    projectId: string,
    take: number | string = 50,
    skip: number | string = 0,
    filters: { eventType?: string; actorUserId?: string; targetType?: string } = {},
  ) {

    const takeInt = Number(take) || 50;
    const skipInt = Number(skip) || 0;
    const where: Prisma.ActivityEventWhereInput = { projectId };

    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.targetType) where.targetType = filters.targetType;

    const [events, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: takeInt,
        skip: skipInt,
        include: ACTOR_INCLUDE,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    return { events, total, take: takeInt, skip: skipInt };
  }


  async findRecent(take: number | string = 20) {

    return this.prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(take) || 20,
      include: ACTOR_INCLUDE,
    });
  }
}
