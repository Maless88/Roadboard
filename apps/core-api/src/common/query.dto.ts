import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MemoryEntryType, ProjectStatus, TaskStatus } from '@roadboard/domain';


export const TASK_FIELD_WHITELIST = [
  'id',
  'title',
  'description',
  'status',
  'priority',
  'phaseId',
  'projectId',
  'assigneeId',
  'dueDate',
  'completionNotes',
  'completedAt',
  'createdAt',
  'updatedAt',
  'createdByUserId',
  'updatedByUserId',
] as const;
export type TaskField = (typeof TASK_FIELD_WHITELIST)[number];

export const TASK_COMPACT_FIELDS: ReadonlyArray<TaskField> = [
  'id',
  'title',
  'status',
  'priority',
  'phaseId',
  'dueDate',
  'createdAt',
];


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

  @IsOptional()
  @IsISO8601()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
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
  @IsISO8601()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  compact?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value))
  @IsArray()
  @ArrayUnique()
  @IsIn(TASK_FIELD_WHITELIST as unknown as readonly string[], { each: true })
  fields?: TaskField[];
}


export class FindMemoryQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsEnum(MemoryEntryType)
  type?: MemoryEntryType;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsISO8601()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
}


export class FindDecisionsQueryDto extends ProjectScopedQueryDto {

  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected', 'superseded'])
  status?: string;

  @IsOptional()
  @IsISO8601()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
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

  @IsOptional()
  @IsIn(['user', 'mcp_token', 'system'])
  actorType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mcpTokenId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dateTo?: string;
}


export class FindRecentAuditQueryDto {

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  take?: number;
}
