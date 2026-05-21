import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { ProjectStatus } from '@roadboard/domain';


export class UpdateProjectDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ownerTeamId?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  // Accept empty string as "clear" (null on persist). Validate URL only when non-empty.
  @IsOptional()
  @ValidateIf((o) => typeof o.homeUrl === 'string' && o.homeUrl.length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  homeUrl?: string;
}
