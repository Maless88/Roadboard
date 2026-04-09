import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class UpdateDecisionDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  summary?: string;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected', 'superseded'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  impactLevel?: string;
}
