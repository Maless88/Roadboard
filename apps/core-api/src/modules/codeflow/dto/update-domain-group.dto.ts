import { IsHexColor, IsNotEmpty, IsOptional, IsString } from 'class-validator';


export class UpdateDomainGroupDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;
}
