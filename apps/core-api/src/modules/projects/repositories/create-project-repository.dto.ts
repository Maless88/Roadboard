import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { CodeRepositoryProvider } from '@roadboard/domain';


export class CreateProjectRepositoryDto {

  @IsEnum(CodeRepositoryProvider)
  provider!: CodeRepositoryProvider;

  @IsUrl()
  @IsNotEmpty()
  repoUrl!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;
}
