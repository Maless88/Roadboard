import { IsNotEmpty, IsString } from 'class-validator';


export class FindByUserQueryDto {

  @IsString()
  @IsNotEmpty()
  userId!: string;
}


export class FindByTeamQueryDto {

  @IsString()
  @IsNotEmpty()
  teamId!: string;
}


export class FindGrantsQueryDto {

  @IsString()
  @IsNotEmpty()
  projectId!: string;
}
