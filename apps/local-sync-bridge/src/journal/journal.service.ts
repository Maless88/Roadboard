import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { optionalEnv } from '@roadboard/config';


export type OperationType = 'create_task' | 'create_memory' | 'update_task_status';


export interface JournalEntry {
  id: string;
  type: OperationType;
  payload: string;
  synced_at: string | null;
  error: string | null;
  created_at: string;
}


const DB_PATH = optionalEnv('JOURNAL_DB_PATH', '.agent/journal.db');


@Injectable()
export class JournalService implements OnModuleInit {

  private readonly logger = new Logger(JournalService.name);
  private db!: Database.Database;


  onModuleInit(): void {

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        synced_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL
      )
    `);

    this.logger.log(`journal opened at ${DB_PATH}`);
  }


  append(type: OperationType, payload: unknown): JournalEntry {

    const id = randomBytes(8).toString('hex');
    const created_at = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);

    this.db
      .prepare('INSERT INTO operations (id, type, payload, synced_at, error, created_at) VALUES (?, ?, ?, NULL, NULL, ?)')
      .run(id, type, payloadStr, created_at);

    return { id, type, payload: payloadStr, synced_at: null, error: null, created_at };
  }


  pending(): JournalEntry[] {

    return this.db
      .prepare('SELECT * FROM operations WHERE synced_at IS NULL ORDER BY created_at ASC')
      .all() as JournalEntry[];
  }


  all(): JournalEntry[] {

    return this.db
      .prepare('SELECT * FROM operations ORDER BY created_at DESC LIMIT 100')
      .all() as JournalEntry[];
  }


  markSynced(id: string): void {

    this.db
      .prepare('UPDATE operations SET synced_at = ?, error = NULL WHERE id = ?')
      .run(new Date().toISOString(), id);
  }


  markFailed(id: string, error: string): void {

    this.db
      .prepare('UPDATE operations SET error = ? WHERE id = ?')
      .run(error, id);
  }
}
