import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { hashToken } from '@roadboard/auth';


@Injectable()
export class AuthGuard implements CanActivate {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const tokenHash = hashToken(token);

    const session = await this.prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      sessionId: session.id,
      userId: session.userId,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
    };

    return true;
  }
}
