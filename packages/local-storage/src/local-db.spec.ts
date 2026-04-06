import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalDatabase } from './local-db.js';


describe('LocalDatabase', () => {

  let db: LocalDatabase;


  beforeEach(() => {

    db = new LocalDatabase();
  });


  afterEach(() => {

    db.close();
  });


  it('should create an in-memory database without errors', () => {

    expect(db).toBeDefined();
  });


  it('should upsert and retrieve projects', () => {

    db.upsertProject({
      id: 'p1',
      slug: 'my-project',
      name: 'My Project',
      status: 'active',
    });

    db.upsertProject({
      id: 'p2',
      slug: 'other-project',
      name: 'Other Project',
      status: 'draft',
    });

    const projects = db.getProjects();

    expect(projects).toHaveLength(2);
    expect(projects[0].id).toBe('p1');
    expect(projects[0].slug).toBe('my-project');
    expect(projects[0].name).toBe('My Project');
    expect(projects[0].status).toBe('active');
    expect(projects[0].syncedAt).toBeTruthy();
  });


  it('should update existing project on upsert', () => {

    db.upsertProject({
      id: 'p1',
      slug: 'my-project',
      name: 'My Project',
      status: 'active',
    });

    db.upsertProject({
      id: 'p1',
      slug: 'my-project',
      name: 'Renamed Project',
      status: 'archived',
    });

    const projects = db.getProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Renamed Project');
    expect(projects[0].status).toBe('archived');
  });


  it('should upsert and retrieve tasks by project', () => {

    db.upsertTask({
      id: 't1',
      projectId: 'p1',
      title: 'Task One',
      status: 'todo',
      priority: 'high',
    });

    db.upsertTask({
      id: 't2',
      projectId: 'p1',
      title: 'Task Two',
      status: 'in_progress',
      priority: 'medium',
    });

    db.upsertTask({
      id: 't3',
      projectId: 'p2',
      title: 'Task Three',
      status: 'done',
      priority: 'low',
    });

    const tasksP1 = db.getTasks('p1');

    expect(tasksP1).toHaveLength(2);
    expect(tasksP1[0].projectId).toBe('p1');
    expect(tasksP1[1].projectId).toBe('p1');

    const tasksP2 = db.getTasks('p2');

    expect(tasksP2).toHaveLength(1);
    expect(tasksP2[0].title).toBe('Task Three');
  });


  it('should add and retrieve pending operations', () => {

    db.addPendingOperation('project', 'p1', 'create', {
      name: 'New Project',
      slug: 'new-project',
    });

    db.addPendingOperation('task', 't1', 'update', {
      status: 'done',
    });

    const ops = db.getPendingOperations();

    expect(ops).toHaveLength(2);
    expect(ops[0].entityType).toBe('project');
    expect(ops[0].entityId).toBe('p1');
    expect(ops[0].operation).toBe('create');
    expect(ops[0].payload).toEqual({ name: 'New Project', slug: 'new-project' });
    expect(ops[0].synced).toBe(false);
    expect(ops[0].createdAt).toBeTruthy();
  });


  it('should mark an operation as synced', () => {

    db.addPendingOperation('project', 'p1', 'create', { name: 'Test' });

    const ops = db.getPendingOperations();

    expect(ops).toHaveLength(1);

    db.markOperationSynced(ops[0].id);

    const opsAfter = db.getPendingOperations();

    expect(opsAfter).toHaveLength(0);
  });


  it('should close without throwing', () => {

    expect(() => db.close()).not.toThrow();
    // Prevent afterEach from closing again
    db = new LocalDatabase();
  });
});
