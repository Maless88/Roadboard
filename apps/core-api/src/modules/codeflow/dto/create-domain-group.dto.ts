import { IsHexColor, IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class CreateDomainGroupDto {

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;
}
