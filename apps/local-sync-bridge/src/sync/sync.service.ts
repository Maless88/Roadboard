import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { optionalEnv } from '@roadboard/config';

import { JournalService } from '../journal/journal.service';


const CORE_API_URL = `http://localhost:${optionalEnv('CORE_API_PORT', '3001')}`;
const SYNC_TOKEN = optionalEnv('SYNC_TOKEN', '');


@Injectable()
export class SyncService {

  private readonly logger = new Logger(SyncService.name);
  private lastSyncAt: string | null = null;
  private lastSyncError: string | null = null;


  constructor(private readonly journal: JournalService) {}


  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledSync(): Promise<void> {

    await this.sync();
  }


  async sync(): Promise<{ synced: number; failed: number; skipped: number }> {

    if (!SYNC_TOKEN) {
      this.lastSyncError = 'SYNC_TOKEN not set';
      return { synced: 0, failed: 0, skipped: 0 };
    }

    const pending = this.journal.pending();

    if (pending.length === 0) {
      return { synced: 0, failed: 0, skipped: 0 };
    }

    this.logger.log(`syncing ${pending.length} pending operations`);

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const entry of pending) {

      const payload = JSON.parse(entry.payload) as Record<string, unknown>;

      try {
        await this.applyOperation(entry.type, payload);
        this.journal.markSynced(entry.id);
        synced++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
          skipped = pending.length - synced - failed;
          this.lastSyncError = 'core-api not reachable';
          break;
        }

        this.journal.markFailed(entry.id, message);
        failed++;
      }
    }

    this.lastSyncAt = new Date().toISOString();

    if (skipped === 0) {
      this.lastSyncError = null;
    }

    this.logger.log(`sync done: synced=${synced} failed=${failed} skipped=${skipped}`);

    return { synced, failed, skipped };
  }


  status(): { lastSyncAt: string | null; lastSyncError: string | null; pending: number } {

    return {
      lastSyncAt: this.lastSyncAt,
      lastSyncError: this.lastSyncError,
      pending: this.journal.pending().length,
    };
  }


  private async applyOperation(type: string, payload: Record<string, unknown>): Promise<void> {

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SYNC_TOKEN}`,
    };

    let res: Response;

    switch (type) {

      case 'create_task':
        res = await fetch(`${CORE_API_URL}/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        break;

      case 'create_memory':
        res = await fetch(`${CORE_API_URL}/memory`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        break;

      case 'update_task_status':
        res = await fetch(`${CORE_API_URL}/tasks/${payload.taskId as string}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: payload.status }),
        });
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    if (!res.ok) {
      throw new Error(`core-api returned ${res.status} for ${type}`);
    }
  }
}
