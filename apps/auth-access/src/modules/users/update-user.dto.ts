import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole, UserStatus } from '@roadboard/domain';


export class UpdateUserDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  managerId?: string;
}
