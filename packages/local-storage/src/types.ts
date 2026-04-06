export interface LocalProject {
  id: string;
  slug: string;
  name: string;
  status: string;
  syncedAt: string | null;
}


export interface LocalTask {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  syncedAt: string | null;
}


export interface PendingOperation {
  id: number;
  entityType: string;
  entityId: string;
  operation: string;
  payload: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
}
