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


  async findOne(idOrSlug: string) {

    const isCuid = /^c[a-z0-9]{24}$/.test(idOrSlug);

    const team = isCuid
      ? await this.prisma.team.findUnique({ where: { id: idOrSlug } })
      : await this.prisma.team.findUnique({ where: { slug: idOrSlug } });

    if (!team) {
      throw new NotFoundException(`Team ${idOrSlug} not found`);
    }

    return team;
  }


  async update(idOrSlug: string, dto: UpdateTeamDto) {

    const existing = await this.findOne(idOrSlug);

    return this.prisma.team.update({
      where: { id: existing.id },
      data: dto,
    });
  }


  async delete(idOrSlug: string) {

    const existing = await this.findOne(idOrSlug);

    return this.prisma.team.delete({ where: { id: existing.id } });
  }
}
