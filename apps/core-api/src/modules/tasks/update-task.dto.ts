import { TaskStatus, TaskPriority } from '@roadboard/domain';


export class UpdateTaskDto {
  projectId?: string;
  phaseId?: string;
  milestoneId?: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
}
