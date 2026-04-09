import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class CreateTokenDto {

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
