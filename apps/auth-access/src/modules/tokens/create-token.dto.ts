import { IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GrantType } from '@roadboard/domain';


export class CreateTokenDto {

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsEnum(GrantType, { each: true })
  scopes!: GrantType[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
