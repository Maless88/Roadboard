import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { hashToken } from '@roadboard/auth';


@Injectable()
export class SessionsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async validate(rawToken: string) {

    const tokenHash = hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      username: session.user.username,
      displayName: session.user.displayName,
      expiresAt: session.expiresAt,
    };
  }


  async findByUser(userId: string) {

    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async revoke(id: string) {

    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
