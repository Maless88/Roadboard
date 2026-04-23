import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';


export class RegisterDto {

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  seedDemoProject?: boolean;

  @IsOptional()
  @IsIn(['it', 'en'])
  demoLocale?: 'it' | 'en';
}
