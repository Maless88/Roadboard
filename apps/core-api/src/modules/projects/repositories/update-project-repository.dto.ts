import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { CodeRepositoryProvider } from '@roadboard/domain';


export class UpdateProjectRepositoryDto {

  @IsOptional()
  @IsEnum(CodeRepositoryProvider)
  provider?: CodeRepositoryProvider;

  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;
}
