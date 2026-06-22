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
    mcpTokenId?: string | null,
  ) {

    return this.prisma.activityEvent.create({
      data: {
        actorType,
        actorId,
        actorUserId: actorUserId ?? null,
        mcpTokenId: mcpTokenId ?? null,
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

    if (user.source === 'mcp' && user.mcpTokenId) {

      return this.record(
        'mcp_token',
        user.mcpTokenId,
        eventType,
        targetType,
        targetId,
        projectId,
        metadata,
        user.userId,
        user.source,
        user.mcpTokenId,
      );
    }

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


  async findRecentAgentEvents(take: number | string = 50) {

    const n = typeof take === "string" ? parseInt(take, 10) || 50 : take;

    return this.prisma.activityEvent.findMany({
      where: { eventType: { startsWith: "agent." } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(n, 1), 200),
    });
  }


  async findByProject(
    projectId: string,
    take: number | string = 50,
    skip: number | string = 0,
    filters: {
      eventType?: string;
      actorUserId?: string;
      targetType?: string;
      actorType?: string;
      mcpTokenId?: string;
      dateFrom?: string | Date;
      dateTo?: string | Date;
    } = {},
  ) {

    const takeInt = Number(take) || 50;
    const skipInt = Number(skip) || 0;
    const where: Prisma.ActivityEventWhereInput = { projectId };

    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.actorType) where.actorType = filters.actorType;
    if (filters.mcpTokenId) where.mcpTokenId = filters.mcpTokenId;

    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};

      if (filters.dateFrom) {
        const from = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);

        if (!Number.isNaN(from.getTime())) createdAt.gte = from;
      }

      if (filters.dateTo) {
        const to = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);

        if (!Number.isNaN(to.getTime())) createdAt.lte = to;
      }

      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    }

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
