import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';


const NODE_TYPES = ['repository', 'app', 'package', 'module', 'service', 'file'];


export class CreateNodeDto {

  @IsString()
  @IsNotEmpty()
  repositoryId!: string;

  @IsIn(NODE_TYPES)
  type!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainGroup?: string;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerTeamId?: string;
}
