import { Injectable } from '@nestjs/common';

import { JournalService } from '../journal/journal.service';
import { SyncService } from '../sync/sync.service';


export interface CreateTaskDto {
  projectId: string;
  title: string;
  priority?: string;
  phaseId?: string;
}


export interface UpdateTaskStatusDto {
  taskId: string;
  status: string;
}


@Injectable()
export class TasksService {

  constructor(
    private readonly journal: JournalService,
    private readonly sync: SyncService,
  ) {}


  async createTask(dto: CreateTaskDto): Promise<{ id: string; queued: boolean; synced: boolean }> {

    const entry = this.journal.append('create_task', dto);
    const result = await this.sync.sync();

    return { id: entry.id, queued: true, synced: result.synced > 0 };
  }


  async updateTaskStatus(dto: UpdateTaskStatusDto): Promise<{ id: string; queued: boolean; synced: boolean }> {

    const entry = this.journal.append('update_task_status', dto);
    const result = await this.sync.sync();

    return { id: entry.id, queued: true, synced: result.synced > 0 };
  }
}
