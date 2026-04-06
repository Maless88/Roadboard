import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { McpTokenStatus } from '@roadboard/domain';
import { generateToken, hashToken } from '@roadboard/auth';
import { CreateTokenDto } from './create-token.dto';


@Injectable()
export class TokensService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateTokenDto) {

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);

    const mcpToken = await this.prisma.mcpToken.create({
      data: {
        userId: dto.userId,
        name: dto.name,
        tokenHash,
        scope: dto.scope,
        status: McpTokenStatus.ACTIVE,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: mcpToken.id,
      token: rawToken,
      name: mcpToken.name,
      scope: mcpToken.scope,
      expiresAt: mcpToken.expiresAt,
      createdAt: mcpToken.createdAt,
    };
  }


  async findByUser(userId: string) {

    return this.prisma.mcpToken.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        scope: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }


  async validate(rawToken: string) {

    const tokenHash = hashToken(rawToken);

    const mcpToken = await this.prisma.mcpToken.findUnique({
      where: { tokenHash },
    });

    if (!mcpToken) {
      throw new UnauthorizedException('Invalid token');
    }

    if (mcpToken.status === McpTokenStatus.REVOKED || mcpToken.revokedAt) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (mcpToken.expiresAt && mcpToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token has expired');
    }

    return {
      userId: mcpToken.userId,
      scope: mcpToken.scope,
    };
  }


  async revoke(id: string) {

    const mcpToken = await this.prisma.mcpToken.findUnique({
      where: { id },
    });

    if (!mcpToken) {
      throw new NotFoundException(`Token ${id} not found`);
    }

    return this.prisma.mcpToken.update({
      where: { id },
      data: {
        status: McpTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }
}
