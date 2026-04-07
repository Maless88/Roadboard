import { Injectable } from '@nestjs/common';

import { JournalService } from '../journal/journal.service';
import { SyncService } from '../sync/sync.service';


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
}
