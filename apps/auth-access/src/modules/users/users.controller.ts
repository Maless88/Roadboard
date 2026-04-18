import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { SelfOrAdminGuard } from '../../common/self-or-admin.guard';
import { CurrentUser } from '../../common/user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ChangePasswordDto } from './change-password.dto';
import { ResetPasswordDto } from './reset-password.dto';


@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {

  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}


  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateUserDto) {

    return this.usersService.create(dto);
  }


  @Get()
  findAll() {

    return this.usersService.findAll();
  }


  @Get(':id')
  findOne(@Param('id') id: string) {

    return this.usersService.findOne(id);
  }


  @UseGuards(SelfOrAdminGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {

    return this.usersService.update(id, dto, user.role);
  }


  @UseGuards(SelfOrAdminGuard)
  @Patch(':id/password')
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {

    return this.usersService.changePassword(id, dto);
  }


  @UseGuards(AdminGuard)
  @Patch(':id/password/reset')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {

    return this.usersService.resetPassword(id, dto);
  }


  @UseGuards(AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.usersService.delete(id);
  }
}
