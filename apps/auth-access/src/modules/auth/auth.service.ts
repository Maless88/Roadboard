import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { hashPassword, verifyPassword, generateToken, hashToken } from '@roadboard/auth';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';


const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;


@Injectable()
export class AuthService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async login(dto: LoginDto) {

    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await verifyPassword(dto.password, user.password);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    return {
      token: rawToken,
      userId: user.id,
      expiresAt,
    };
  }


  async register(dto: RegisterDto) {

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });

    if (existing) {
      const field = existing.username === dto.username ? 'username' : 'email';
      throw new ConflictException(`This ${field} is already taken`);
    }

    const hashed = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        displayName: dto.displayName,
        email: dto.email,
        password: hashed,
      },
    });

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.session.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    return { token: rawToken, userId: user.id, expiresAt };
  }


  async logout(rawToken: string) {

    const tokenHash = hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { token: tokenHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }
}
