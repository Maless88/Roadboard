import { IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class UpdateTeamDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
