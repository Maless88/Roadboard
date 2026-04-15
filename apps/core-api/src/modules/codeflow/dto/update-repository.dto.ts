import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';


export class UpdateRepositoryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsOptional()
  @IsIn(['github', 'gitlab', 'local', 'manual'])
  provider?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  scanIntervalH?: number;
}
