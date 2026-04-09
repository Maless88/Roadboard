import { IsNotEmpty, IsString } from 'class-validator';


export class ValidateSessionDto {

  @IsString()
  @IsNotEmpty()
  token!: string;
}
