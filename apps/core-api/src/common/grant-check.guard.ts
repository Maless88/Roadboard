import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

  private readonly authAccessPort: string;

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {

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

    const projectId = this.extractProjectId(request);

    if (!projectId) {
      return true;
    }

    try {

      const url = new URL(`http://localhost:${this.authAccessPort}/grants/check`);
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
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    } catch (error) {

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Grant check service unavailable');
    }
  }


  private extractProjectId(request: Record<string, unknown>): string | undefined {

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

    return undefined;
  }
}
