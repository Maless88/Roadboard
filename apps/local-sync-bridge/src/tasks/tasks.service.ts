import { Injectable } from '@nestjs/common';
import { optionalEnv } from '@roadboard/config';

import { JournalService } from '../journal/journal.service';
import { SyncService } from '../sync/sync.service';


const CORE_API_URL = `http://${optionalEnv('CORE_API_HOST', 'localhost')}:${optionalEnv('CORE_API_PORT', '3001')}`;
const SYNC_TOKEN = optionalEnv('SYNC_TOKEN', '');


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


  async listTasks(projectId: string, status?: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });

    if (status) {
      params.set('status', status);
    }

    const res = await fetch(`${CORE_API_URL}/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${SYNC_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`core-api listTasks failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }
}
