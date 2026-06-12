import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';


export class CreateDecisionDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  summary!: string;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected', 'superseded'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  impactLevel?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  createdByUserId?: string;
}
