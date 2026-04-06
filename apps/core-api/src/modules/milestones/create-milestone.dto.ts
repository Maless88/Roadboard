import { MilestoneStatus } from '@roadboard/domain';


export class CreateMilestoneDto {
  projectId!: string;
  phaseId?: string;
  title!: string;
  description?: string;
  dueDate?: Date;
  status?: MilestoneStatus;
  orderIndex?: number;
}
