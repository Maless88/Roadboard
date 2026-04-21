import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { TeamMembershipRole, TeamMembershipStatus } from '@roadboard/domain';
import { CreateMembershipDto } from './create-membership.dto';
import { UpdateMembershipDto } from './update-membership.dto';


@Injectable()
export class MembershipsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateMembershipDto) {

    return this.prisma.teamMembership.create({
      data: {
        teamId: dto.teamId,
        userId: dto.userId,
        role: dto.role ?? TeamMembershipRole.MEMBER,
        status: TeamMembershipStatus.ACTIVE,
      },
    });
  }


  async findByTeam(teamId: string) {

    return this.prisma.teamMembership.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }


  async findByUser(userId: string) {

    return this.prisma.teamMembership.findMany({
      where: { userId },
      include: {
        team: true,
      },
    });
  }


  async findOne(id: string) {

    const membership = await this.prisma.teamMembership.findUnique({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${id} not found`);
    }

    return membership;
  }


  async update(id: string, dto: UpdateMembershipDto) {

    await this.findOne(id);

    return this.prisma.teamMembership.update({
      where: { id },
      data: dto,
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.teamMembership.delete({ where: { id } });
  }
}
