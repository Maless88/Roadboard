import { PhaseStatus } from '@roadboard/domain';


export class UpdatePhaseDto {
  projectId?: string;
  title?: string;
  description?: string;
  orderIndex?: number;
  status?: PhaseStatus;
  startDate?: Date;
  endDate?: Date;
}
