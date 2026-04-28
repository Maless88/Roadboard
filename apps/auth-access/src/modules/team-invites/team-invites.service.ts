import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import {
  TeamInviteStatus,
  TeamMembershipRole,
  TeamMembershipStatus,
} from '@roadboard/domain';
import { CreateTeamInviteDto } from './create-team-invite.dto';


const DEFAULT_EXPIRES_DAYS = 7;


function generateToken(): string {

  return randomBytes(32).toString('base64url');
}


function normalizeEmail(email: string): string {

  return email.trim().toLowerCase();
}


@Injectable()
export class TeamInvitesService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  private async assertTeamAdmin(teamId: string, userId: string): Promise<void> {

    const membership = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (
      !membership
      || membership.status !== TeamMembershipStatus.ACTIVE
      || membership.role !== TeamMembershipRole.ADMIN
    ) {
      throw new ForbiddenException('Only team admins can manage invites');
    }
  }


  private async assertTeamMember(teamId: string, userId: string): Promise<void> {

    const membership = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership || membership.status !== TeamMembershipStatus.ACTIVE) {
      throw new ForbiddenException('Only team members can view invites');
    }
  }


  async create(teamId: string, actorUserId: string, dto: CreateTeamInviteDto) {

    await this.assertTeamAdmin(teamId, actorUserId);

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const email = normalizeEmail(dto.email);
    const role = dto.role ?? TeamMembershipRole.MEMBER;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      const alreadyMember = await this.prisma.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });

      if (alreadyMember && alreadyMember.status === TeamMembershipStatus.ACTIVE) {
        throw new BadRequestException(`${email} is already a member of this team`);
      }
    }

    const existingPending = await this.prisma.teamInvite.findFirst({
      where: { teamId, email, status: TeamInviteStatus.PENDING },
    });

    if (existingPending && existingPending.expiresAt > new Date()) {
      return existingPending;
    }

    const days = dto.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    return this.prisma.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        token: generateToken(),
        invitedByUserId: actorUserId,
        expiresAt,
      },
    });
  }


  async list(teamId: string, actorUserId: string) {

    await this.assertTeamMember(teamId, actorUserId);

    return this.prisma.teamInvite.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, displayName: true, username: true } },
        acceptedBy: { select: { id: true, displayName: true, username: true } },
      },
    });
  }


  async revoke(inviteId: string, actorUserId: string) {

    const invite = await this.prisma.teamInvite.findUnique({ where: { id: inviteId } });

    if (!invite) throw new NotFoundException(`Invite ${inviteId} not found`);

    await this.assertTeamAdmin(invite.teamId, actorUserId);

    if (invite.status !== TeamInviteStatus.PENDING) {
      throw new BadRequestException(`Cannot revoke invite in status ${invite.status}`);
    }

    return this.prisma.teamInvite.update({
      where: { id: inviteId },
      data: { status: TeamInviteStatus.REVOKED, revokedAt: new Date() },
    });
  }


  async findByToken(token: string) {

    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: {
        team: { select: { id: true, name: true, slug: true, description: true } },
        invitedBy: { select: { id: true, displayName: true, username: true } },
      },
    });

    if (!invite) throw new NotFoundException('Invite not found');

    const expired = invite.expiresAt < new Date();
    const effectiveStatus = expired && invite.status === TeamInviteStatus.PENDING
      ? TeamInviteStatus.EXPIRED
      : invite.status;

    return { ...invite, status: effectiveStatus };
  }


  async accept(token: string, actorUserId: string) {

    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });

    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.status !== TeamInviteStatus.PENDING) {
      throw new BadRequestException(`Invite is ${invite.status}`);
    }

    if (invite.expiresAt < new Date()) {

      await this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: TeamInviteStatus.EXPIRED },
      });
      throw new BadRequestException('Invite has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: actorUserId } });

    if (!user) throw new NotFoundException('User not found');

    if (normalizeEmail(user.email) !== invite.email) {
      throw new ForbiddenException(
        `This invite is for ${invite.email}. Sign in with that account to accept.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {

      const existing = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
      });

      if (existing) {

        await tx.teamMembership.update({
          where: { id: existing.id },
          data: { status: TeamMembershipStatus.ACTIVE, role: invite.role },
        });
      } else {

        await tx.teamMembership.create({
          data: {
            teamId: invite.teamId,
            userId: user.id,
            role: invite.role,
            status: TeamMembershipStatus.ACTIVE,
          },
        });
      }

      return tx.teamInvite.update({
        where: { id: invite.id },
        data: {
          status: TeamInviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });
    });
  }
}
