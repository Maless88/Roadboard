import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { GrantSubjectType, GrantType } from '@roadboard/domain';


export class CheckPermissionDto {

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
}
