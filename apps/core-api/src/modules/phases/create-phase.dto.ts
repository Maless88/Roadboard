import { PhaseStatus } from '@roadboard/domain';


export class CreatePhaseDto {
  projectId!: string;
  title!: string;
  description?: string;
  orderIndex?: number;
  status?: PhaseStatus;
  startDate?: Date;
  endDate?: Date;
}
