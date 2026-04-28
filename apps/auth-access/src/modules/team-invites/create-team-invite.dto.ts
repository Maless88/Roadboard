import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { TeamMembershipRole } from '@roadboard/domain';


export class CreateTeamInviteDto {

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(TeamMembershipRole)
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}


export class AcceptTeamInviteDto {

  @IsString()
  @IsNotEmpty()
  token!: string;
}
