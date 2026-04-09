import { Injectable } from '@nestjs/common';
import { optionalEnv } from '@roadboard/config';

import { JournalService } from '../journal/journal.service';
import { SyncService } from '../sync/sync.service';


const CORE_API_URL = `http://${optionalEnv('CORE_API_HOST', 'localhost')}:${optionalEnv('CORE_API_PORT', '3001')}`;
const SYNC_TOKEN = optionalEnv('SYNC_TOKEN', '');


export interface CreateMemoryDto {
  projectId: string;
  type: string;
  title: string;
  body?: string;
}


@Injectable()
export class MemoryService {

  constructor(
    private readonly journal: JournalService,
    private readonly sync: SyncService,
  ) {}


  async createMemory(dto: CreateMemoryDto): Promise<{ id: string; queued: boolean; synced: boolean }> {

    const entry = this.journal.append('create_memory', dto);
    const result = await this.sync.sync();

    return { id: entry.id, queued: true, synced: result.synced > 0 };
  }


  async listMemory(projectId: string, type?: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });

    if (type) {
      params.set('type', type);
    }

    const res = await fetch(`${CORE_API_URL}/memory?${params.toString()}`, {
      headers: { Authorization: `Bearer ${SYNC_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`core-api listMemory failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }
}
