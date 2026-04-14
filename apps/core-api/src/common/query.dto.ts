import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { MemoryEntryType, ProjectStatus, TaskStatus } from '@roadboard/domain';


export class FindProjectsQueryDto {

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}


export class ProjectScopedQueryDto {

  @IsString()
  @IsNotEmpty()
  projectId!: string;
}


export class FindMilestonesQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phaseId?: string;
}


export class FindTasksQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phaseId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  milestoneId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}


export class FindMemoryQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsEnum(MemoryEntryType)
  type?: MemoryEntryType;

  @IsOptional()
  @IsString()
  q?: string;
}


export class FindDecisionsQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected', 'superseded'])
  status?: string;
}


export class FindProjectAuditQueryDto {

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}


export class FindRecentAuditQueryDto {

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;
}
