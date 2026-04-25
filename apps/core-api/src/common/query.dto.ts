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


export class FindPhasesQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  decisionId?: string;
}


export class FindTasksQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phaseId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}


export class FindMemoryQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsEnum(MemoryEntryType)
  type?: MemoryEntryType;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  eventType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetType?: string;
}


export class FindRecentAuditQueryDto {

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;
}
