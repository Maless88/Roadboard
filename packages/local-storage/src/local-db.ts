import Database from 'better-sqlite3';

import type { LocalProject, LocalTask, PendingOperation } from './types.js';


export class LocalDatabase {

  private db: Database.Database;


  constructor(filePath: string = ':memory:') {

    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }


  private init(): void {

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_projects (
        id TEXT PRIMARY KEY,
        slug TEXT,
        name TEXT,
        status TEXT,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS local_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        status TEXT,
        priority TEXT,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT,
        entity_id TEXT,
        operation TEXT,
        payload TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
  }


  upsertProject(project: {
    id: string;
    slug: string;
    name: string;
    status: string;
  }): void {

    const stmt = this.db.prepare(`
      INSERT INTO local_projects (id, slug, name, status, synced_at)
      VALUES (@id, @slug, @name, @status, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        status = excluded.status,
        synced_at = datetime('now')
    `);

    stmt.run(project);
  }


  upsertTask(task: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
  }): void {

    const stmt = this.db.prepare(`
      INSERT INTO local_tasks (id, project_id, title, status, priority, synced_at)
      VALUES (@id, @projectId, @title, @status, @priority, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        title = excluded.title,
        status = excluded.status,
        priority = excluded.priority,
        synced_at = datetime('now')
    `);

    stmt.run(task);
  }


  getProjects(): LocalProject[] {

    const rows = this.db.prepare('SELECT * FROM local_projects').all() as Array<{
      id: string;
      slug: string;
      name: string;
      status: string;
      synced_at: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      syncedAt: row.synced_at,
    }));
  }


  getTasks(projectId: string): LocalTask[] {

    const rows = this.db
      .prepare('SELECT * FROM local_tasks WHERE project_id = ?')
      .all(projectId) as Array<{
        id: string;
        project_id: string;
        title: string;
        status: string;
        priority: string;
        synced_at: string | null;
      }>;

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      syncedAt: row.synced_at,
    }));
  }


  addPendingOperation(
    entityType: string,
    entityId: string,
    operation: string,
    payload: Record<string, unknown>,
  ): void {

    const stmt = this.db.prepare(`
      INSERT INTO pending_operations (entity_type, entity_id, operation, payload)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(entityType, entityId, operation, JSON.stringify(payload));
  }


  getPendingOperations(): PendingOperation[] {

    const rows = this.db
      .prepare('SELECT * FROM pending_operations WHERE synced = 0')
      .all() as Array<{
        id: number;
        entity_type: string;
        entity_id: string;
        operation: string;
        payload: string;
        created_at: string;
        synced: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      createdAt: row.created_at,
      synced: row.synced === 1,
    }));
  }


  markOperationSynced(id: number): void {

    this.db
      .prepare('UPDATE pending_operations SET synced = 1 WHERE id = ?')
      .run(id);
  }


  close(): void {

    this.db.close();
  }
}
