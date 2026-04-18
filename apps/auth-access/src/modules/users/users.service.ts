import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient, User } from '@roadboard/database';
import { hashPassword, verifyPassword } from '@roadboard/auth';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ChangePasswordDto } from './change-password.dto';
import { ResetPasswordDto } from './reset-password.dto';


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
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.managerId ? { managerId: dto.managerId } : {}),
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


  async update(id: string, dto: UpdateUserDto, callerRole?: string) {

    await this.findOne(id);

    if (dto.role && callerRole !== 'admin') {
      throw new ForbiddenException('Only admins can change user roles');
    }

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


  async changePassword(id: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const valid = await verifyPassword(dto.currentPassword, user.password);

    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashed = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { success: true };
  }


  async resetPassword(id: string, dto: ResetPasswordDto): Promise<{ success: boolean }> {

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const hashed = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { success: true };
  }
}
