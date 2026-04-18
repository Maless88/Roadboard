import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';


@Injectable()
export class SelfOrAdminGuard implements CanActivate {

  canActivate(context: ExecutionContext): boolean {

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string; role: string } | undefined;
    const targetId = (request.params as Record<string, string>).id;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (user.role === 'admin' || user.userId === targetId) {
      return true;
    }

    throw new ForbiddenException('Access denied: you can only modify your own account');
  }
}
