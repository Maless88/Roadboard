import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TeamMembershipRole } from '@roadboard/domain';


export class CreateMembershipDto {

  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsEnum(TeamMembershipRole)
  role?: string;
}
