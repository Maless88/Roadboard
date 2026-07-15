import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@roadboard/database';
import { GrantType } from '@roadboard/domain';
import { optionalEnv } from '@roadboard/config';
import { REQUIRED_GRANT_KEY } from './require-grant.decorator';


interface GrantCheckResponse {
  allowed: boolean;
}


interface AuthenticatedUser {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: string;
}


@Injectable()
export class GrantCheckGuard implements CanActivate {

  private readonly logger = new Logger(GrantCheckGuard.name);
  private readonly authAccessHost: string;
  private readonly authAccessPort: string;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject('PRISMA') private readonly prisma: PrismaClient,
  ) {

    this.authAccessHost = optionalEnv('AUTH_ACCESS_HOST', 'localhost');
    this.authAccessPort = optionalEnv('AUTH_ACCESS_PORT', '4002');
  }


  async canActivate(context: ExecutionContext): Promise<boolean> {

    const requiredGrant = this.reflector.getAllAndOverride<GrantType | undefined>(
      REQUIRED_GRANT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredGrant) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const projectId = await this.resolveProjectId(request);

    if (!projectId) {
      return true;
    }

    try {

      const url = new URL(`http://${this.authAccessHost}:${this.authAccessPort}/grants/check`);
      url.searchParams.set('projectId', projectId);
      url.searchParams.set('subjectType', 'user');
      url.searchParams.set('subjectId', user.userId);
      url.searchParams.set('grantType', requiredGrant);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new ForbiddenException('Grant check failed');
      }

      const data = (await response.json()) as GrantCheckResponse;

      if (!data.allowed) {
        this.logger.warn('Grant check failed', { requiredGrant, projectId, subjectId: user.userId });
        throw new ForbiddenException({
          message: 'Insufficient permissions',
          requiredGrant,
          projectId,
        });
      }

      return true;
    } catch (error) {

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Grant check service unavailable');
    }
  }


  private async resolveProjectId(request: Record<string, unknown>): Promise<string | undefined> {

    const body = request.body as Record<string, unknown> | undefined;

    if (body && typeof body.projectId === 'string') {
      return body.projectId;
    }

    const query = request.query as Record<string, unknown> | undefined;

    if (query && typeof query.projectId === 'string') {
      return query.projectId;
    }

    const params = request.params as Record<string, unknown> | undefined;

    if (params && typeof params.projectId === 'string') {
      return params.projectId;
    }

    // Resolve via DB when only a resource ID is in params (e.g. PATCH /tasks/:id).
    // Every project-scoped table addressed by a bare :id must be resolvable here,
    // otherwise the grant check would silently no-op (cross-project IDOR).
    if (params && typeof params.id === 'string') {

      const id = params.id;

      const project = await this.prisma.project.findUnique({
        where: { id },
        select: { id: true },
      }).catch(() => null);

      if (project) {
        return project.id;
      }

      const lookups: Array<() => Promise<{ projectId: string } | null>> = [
        () => this.prisma.task.findUnique({ where: { id }, select: { projectId: true } }),
        () => this.prisma.phase.findUnique({ where: { id }, select: { projectId: true } }),
        () => this.prisma.decision.findUnique({ where: { id }, select: { projectId: true } }),
        () => this.prisma.memoryEntry.findUnique({ where: { id }, select: { projectId: true } }),
        () => this.prisma.codeRepository.findUnique({ where: { id }, select: { projectId: true } }),
        () => this.prisma.domainGroup.findUnique({ where: { id }, select: { projectId: true } }),
      ];

      for (const lookup of lookups) {

        const row = await lookup().catch(() => null);

        if (row) {
          return row.projectId;
        }
      }

      // Fail closed: a bare :id that matches no known project-scoped resource
      // must not silently bypass the grant check.
      throw new ForbiddenException('Unable to resolve project for grant check');
    }

    return undefined;
  }
}
