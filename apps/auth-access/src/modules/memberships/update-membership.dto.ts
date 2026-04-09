import { IsEnum, IsOptional } from 'class-validator';
import { TeamMembershipRole, TeamMembershipStatus } from '@roadboard/domain';


export class UpdateMembershipDto {

  @IsOptional()
  @IsEnum(TeamMembershipRole)
  role?: string;

  @IsOptional()
  @IsEnum(TeamMembershipStatus)
  status?: string;
}
