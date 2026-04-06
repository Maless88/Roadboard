import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreateTeamDto } from './create-team.dto';
import { UpdateTeamDto } from './update-team.dto';


@Injectable()
export class TeamsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateTeamDto) {

    return this.prisma.team.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
      },
    });
  }


  async findAll() {

    return this.prisma.team.findMany();
  }


  async findOne(id: string) {

    const team = await this.prisma.team.findUnique({ where: { id } });

    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    return team;
  }


  async update(id: string, dto: UpdateTeamDto) {

    await this.findOne(id);

    return this.prisma.team.update({
      where: { id },
      data: dto,
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.team.delete({ where: { id } });
  }
}
