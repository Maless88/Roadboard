import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { McpTokenStatus } from '@roadboard/domain';
import { TokensService } from './tokens.service';


vi.mock('@roadboard/auth', () => ({
  generateToken: vi.fn(() => 'raw-token'),
  hashToken: vi.fn((t: string) => `hashed:${t}`),
}));


function makePrisma() {

  const mcpToken = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };

  return { mcpToken } as const;
}


function activeToken(overrides: Record<string, unknown> = {}) {

  return {
    id: 'tok-1',
    name: 'My token',
    userId: 'u-1',
    tokenHash: 'hashed:raw-token',
    scopes: ['read'],
    status: McpTokenStatus.ACTIVE,
    revokedAt: null,
    expiresAt: null,
    user: { status: 'active' },
    ...overrides,
  };
}


describe('TokensService.validate', () => {

  let prisma: ReturnType<typeof makePrisma>;
  let svc: TokensService;

  beforeEach(() => {

    prisma = makePrisma();
    svc = new TokensService(prisma as never);
    vi.clearAllMocks();
  });


  it('returns userId, scopes, tokenId and tokenName for a valid active-user token', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(activeToken());

    const result = await svc.validate('raw-token');

    expect(result).toEqual({ userId: 'u-1', scopes: ['read'], tokenId: 'tok-1', tokenName: 'My token' });
  });


  it('throws UnauthorizedException when token is not found', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(null);

    await expect(svc.validate('raw-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });


  it('throws UnauthorizedException when token is revoked', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(
      activeToken({ status: McpTokenStatus.REVOKED, revokedAt: new Date() }),
    );

    await expect(svc.validate('raw-token')).rejects.toThrow('Token has been revoked');
  });


  it('throws UnauthorizedException when token has revokedAt set', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(
      activeToken({ revokedAt: new Date() }),
    );

    await expect(svc.validate('raw-token')).rejects.toThrow('Token has been revoked');
  });


  it('throws UnauthorizedException when token is expired', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(
      activeToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(svc.validate('raw-token')).rejects.toThrow('Token has expired');
  });


  it('throws UnauthorizedException when user is null', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(activeToken({ user: null }));

    await expect(svc.validate('raw-token')).rejects.toThrow('User account disabled');
  });


  it('throws UnauthorizedException when user.status is disabled', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(
      activeToken({ user: { status: 'disabled' } }),
    );

    await expect(svc.validate('raw-token')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.validate('raw-token')).rejects.toThrow('User account disabled');
  });


  it('throws UnauthorizedException when user.status is suspended', async () => {

    prisma.mcpToken.findUnique.mockResolvedValue(
      activeToken({ user: { status: 'suspended' } }),
    );

    await expect(svc.validate('raw-token')).rejects.toThrow('User account disabled');
  });
});
