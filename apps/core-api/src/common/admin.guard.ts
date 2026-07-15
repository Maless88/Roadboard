import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';


/**
 * Restricts a route to platform admins (User.role === 'admin').
 * Must run after AuthGuard, which populates request.user.
 */
@Injectable()
export class AdminGuard implements CanActivate {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId?: string } | undefined;

    if (!user?.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const row = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });

    if (row?.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
