import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ChangePasswordDto } from './change-password.dto';


@Controller('users')
export class UsersController {

  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}


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


  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {

    return this.usersService.update(id, dto);
  }


  @Patch(':id/password')
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {

    return this.usersService.changePassword(id, dto);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {

    return this.usersService.delete(id);
  }
}
