import { ProjectStatus } from '@roadboard/domain';


export class UpdateProjectDto {
  name?: string;
  slug?: string;
  description?: string;
  ownerTeamId?: string;
  status?: ProjectStatus;
}
