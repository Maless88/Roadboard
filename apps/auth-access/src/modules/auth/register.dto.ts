import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';


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
}
