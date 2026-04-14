import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';


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
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected', 'superseded'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  impactLevel?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  resolvedAt?: Date;
}
