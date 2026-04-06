import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, User } from '@roadboard/database';
import { hashPassword } from '@roadboard/auth';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';


@Injectable()
export class UsersService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  private excludePassword(user: User): Omit<User, 'password'> {

    const { password: _password, ...rest } = user;

    return rest;
  }


  async create(dto: CreateUserDto) {

    const hashed = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        displayName: dto.displayName,
        email: dto.email,
        password: hashed,
      },
    });

    return this.excludePassword(user);
  }


  async findAll() {

    const users = await this.prisma.user.findMany();

    return users.map((u) => this.excludePassword(u));
  }


  async findOne(id: string) {

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return this.excludePassword(user);
  }


  async findOneByUsername(username: string) {

    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }

    return user;
  }


  async update(id: string, dto: UpdateUserDto) {

    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    return this.excludePassword(user);
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.user.delete({ where: { id } });
  }
}
