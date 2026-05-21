import { IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class UpdateNodeDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainGroup?: string;

  @IsOptional()
  @IsString()
  domainGroupId?: string | null;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerTeamId?: string;
}
