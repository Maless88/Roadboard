import { TaskStatus, TaskPriority } from '@roadboard/domain';


export class CreateTaskDto {
  projectId!: string;
  phaseId?: string;
  milestoneId?: string;
  title!: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
}
