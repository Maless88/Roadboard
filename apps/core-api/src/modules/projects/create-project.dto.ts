import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ProjectStatus } from '@roadboard/domain';


export class CreateProjectDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((o) => !o.ownerTeamSlug)
  @IsString()
  @IsNotEmpty()
  ownerTeamId?: string;

  @ValidateIf((o) => !o.ownerTeamId)
  @IsString()
  @IsNotEmpty()
  ownerTeamSlug?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
