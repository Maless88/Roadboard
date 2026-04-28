import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamMembershipRole, TeamMembershipStatus, TeamInviteStatus } from '@roadboard/domain';
import { TeamInvitesService } from './team-invites.service';


type Mock<T> = ReturnType<typeof vi.fn>;


function makePrisma() {

  const teamInvite = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  };

  const teamMembership = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const team = { findUnique: vi.fn() };
  const user = { findUnique: vi.fn() };

  const $transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb({
    teamInvite, teamMembership, team, user,
  }));

  return { teamInvite, teamMembership, team, user, $transaction } as const;
}


function adminMembership() {
  return {
    id: 'm-admin', teamId: 't1', userId: 'u-admin',
    role: TeamMembershipRole.ADMIN, status: TeamMembershipStatus.ACTIVE,
  };
}


describe('TeamInvitesService', () => {

  let prisma: ReturnType<typeof makePrisma>;
  let svc: TeamInvitesService;

  beforeEach(() => {

    prisma = makePrisma();
    svc = new TeamInvitesService(prisma as never);
  });


  describe('create', () => {

    it('rejects non-admin users', async () => {

      prisma.teamMembership.findUnique.mockResolvedValue({
        ...adminMembership(), role: TeamMembershipRole.MEMBER,
      });

      await expect(
        svc.create('t1', 'u1', { email: 'x@y.z' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });


    it('rejects when team does not exist', async () => {

      prisma.teamMembership.findUnique.mockResolvedValue(adminMembership());
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(
        svc.create('t1', 'u-admin', { email: 'x@y.z' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });


    it('rejects if email already belongs to an active member', async () => {

      prisma.teamMembership.findUnique
        .mockResolvedValueOnce(adminMembership())
        .mockResolvedValueOnce({ status: TeamMembershipStatus.ACTIVE });
      prisma.team.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u-existing', email: 'x@y.z' });

      await expect(
        svc.create('t1', 'u-admin', { email: 'X@Y.Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });


    it('returns existing pending invite if not expired', async () => {

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const existing = {
        id: 'inv1', teamId: 't1', email: 'x@y.z', status: TeamInviteStatus.PENDING, expiresAt: future,
      };
      prisma.teamMembership.findUnique.mockResolvedValue(adminMembership());
      prisma.team.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.teamInvite.findFirst.mockResolvedValue(existing);

      const result = await svc.create('t1', 'u-admin', { email: 'x@y.z' });

      expect(result).toBe(existing);
      expect(prisma.teamInvite.create).not.toHaveBeenCalled();
    });


    it('creates a new invite with normalized email', async () => {

      prisma.teamMembership.findUnique.mockResolvedValue(adminMembership());
      prisma.team.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.teamInvite.findFirst.mockResolvedValue(null);
      prisma.teamInvite.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));

      const result = await svc.create('t1', 'u-admin', { email: 'X@Y.Z ', expiresInDays: 14 });

      const call = (prisma.teamInvite.create as Mock<unknown>).mock.calls[0][0] as any;
      expect(call.data.email).toBe('x@y.z');
      expect(call.data.teamId).toBe('t1');
      expect(call.data.invitedByUserId).toBe('u-admin');
      expect(call.data.token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(call.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 13 * 86400 * 1000);
      expect(result.email).toBe('x@y.z');
    });
  });


  describe('accept', () => {

    it('rejects when invite not found', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue(null);

      await expect(svc.accept('tok', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });


    it('rejects when invite is not pending', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', status: TeamInviteStatus.REVOKED, expiresAt: new Date(Date.now() + 1000),
      });

      await expect(svc.accept('tok', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });


    it('marks expired and rejects when past expiresAt', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', status: TeamInviteStatus.PENDING, expiresAt: new Date(Date.now() - 1000),
      });

      await expect(svc.accept('tok', 'u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.teamInvite.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: TeamInviteStatus.EXPIRED },
      }));
    });


    it('rejects when user email does not match invite email', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', teamId: 't1', email: 'a@b.c', role: 'member',
        status: TeamInviteStatus.PENDING, expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'other@x.y' });

      await expect(svc.accept('tok', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    });


    it('creates membership and marks invite accepted on happy path', async () => {

      const invite = {
        id: 'i', teamId: 't1', email: 'a@b.c', role: 'admin',
        status: TeamInviteStatus.PENDING, expiresAt: new Date(Date.now() + 60_000),
      };
      prisma.teamInvite.findUnique.mockResolvedValue(invite);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'A@B.C' });
      prisma.teamMembership.findUnique.mockResolvedValue(null);
      prisma.teamInvite.update.mockImplementation(async ({ data }: any) => ({ ...invite, ...data }));

      const result = await svc.accept('tok', 'u1');

      expect(prisma.teamMembership.create).toHaveBeenCalledWith({
        data: {
          teamId: 't1', userId: 'u1', role: 'admin', status: TeamMembershipStatus.ACTIVE,
        },
      });
      expect(result.status).toBe(TeamInviteStatus.ACCEPTED);
      expect(result.acceptedByUserId).toBe('u1');
    });
  });


  describe('revoke', () => {

    it('rejects when invite is not pending', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', teamId: 't1', status: TeamInviteStatus.ACCEPTED,
      });
      prisma.teamMembership.findUnique.mockResolvedValue(adminMembership());

      await expect(svc.revoke('i', 'u-admin')).rejects.toBeInstanceOf(BadRequestException);
    });


    it('marks invite as revoked', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', teamId: 't1', status: TeamInviteStatus.PENDING,
      });
      prisma.teamMembership.findUnique.mockResolvedValue(adminMembership());

      await svc.revoke('i', 'u-admin');

      expect(prisma.teamInvite.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'i' },
        data: expect.objectContaining({ status: TeamInviteStatus.REVOKED }),
      }));
    });
  });


  describe('findByToken', () => {

    it('flips status to expired when past expiresAt and still pending', async () => {

      prisma.teamInvite.findUnique.mockResolvedValue({
        id: 'i', teamId: 't1', status: TeamInviteStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000),
        team: { id: 't1', name: 'X', slug: 'x', description: null },
      });

      const result = await svc.findByToken('tok');

      expect(result.status).toBe(TeamInviteStatus.EXPIRED);
    });
  });
});
