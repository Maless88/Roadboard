import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GrantSubjectType, GrantType } from '@roadboard/domain';


export class CreateGrantDto {

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsEnum(GrantSubjectType)
  subjectType!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsEnum(GrantType)
  grantType!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  grantedByUserId?: string;
}
