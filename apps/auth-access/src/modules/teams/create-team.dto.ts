import { IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class CreateTeamDto {

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
