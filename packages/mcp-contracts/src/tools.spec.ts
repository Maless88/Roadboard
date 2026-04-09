import { describe, it, expect } from 'vitest';

import {
  MCP_TOOLS,
  LIST_PROJECTS_TOOL,
  GET_PROJECT_TOOL,
  LIST_ACTIVE_TASKS_TOOL,
  GET_PROJECT_MEMORY_TOOL,
  CREATE_TASK_TOOL,
  UPDATE_TASK_STATUS_TOOL,
  CREATE_MEMORY_ENTRY_TOOL,
  PREPARE_TASK_CONTEXT_TOOL,
  PREPARE_PROJECT_SUMMARY_TOOL,
  CREATE_HANDOFF_TOOL,
} from './tools';


describe('MCP_TOOLS', () => {

  it('exports exactly 12 tools', () => {
    expect(MCP_TOOLS).toHaveLength(12);
  });

  it('all tools have name, description and inputSchema', () => {
    for (const tool of MCP_TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('tool names are unique', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});


describe('read tools', () => {

  it('list_projects has optional status filter', () => {
    expect(LIST_PROJECTS_TOOL.name).toBe('list_projects');
    expect((LIST_PROJECTS_TOOL.inputSchema.required as string[] | undefined)).toBeUndefined();
  });

  it('get_project requires projectId', () => {
    expect(GET_PROJECT_TOOL.name).toBe('get_project');
    expect(GET_PROJECT_TOOL.inputSchema.required).toContain('projectId');
  });

  it('list_active_tasks requires projectId', () => {
    expect(LIST_ACTIVE_TASKS_TOOL.name).toBe('list_active_tasks');
    expect(LIST_ACTIVE_TASKS_TOOL.inputSchema.required).toContain('projectId');
  });

  it('get_project_memory requires projectId', () => {
    expect(GET_PROJECT_MEMORY_TOOL.name).toBe('get_project_memory');
    expect(GET_PROJECT_MEMORY_TOOL.inputSchema.required).toContain('projectId');
  });
});


describe('write tools', () => {

  it('create_task requires projectId and title', () => {
    expect(CREATE_TASK_TOOL.name).toBe('create_task');
    expect(CREATE_TASK_TOOL.inputSchema.required).toContain('projectId');
    expect(CREATE_TASK_TOOL.inputSchema.required).toContain('title');
  });

  it('update_task_status requires taskId and status', () => {
    expect(UPDATE_TASK_STATUS_TOOL.name).toBe('update_task_status');
    expect(UPDATE_TASK_STATUS_TOOL.inputSchema.required).toContain('taskId');
    expect(UPDATE_TASK_STATUS_TOOL.inputSchema.required).toContain('status');
  });

  it('create_memory_entry requires projectId, type, title', () => {
    expect(CREATE_MEMORY_ENTRY_TOOL.name).toBe('create_memory_entry');
    expect(CREATE_MEMORY_ENTRY_TOOL.inputSchema.required).toContain('projectId');
    expect(CREATE_MEMORY_ENTRY_TOOL.inputSchema.required).toContain('type');
    expect(CREATE_MEMORY_ENTRY_TOOL.inputSchema.required).toContain('title');
  });
});


describe('workflow tools', () => {

  it('prepare_task_context requires projectId and taskId', () => {
    expect(PREPARE_TASK_CONTEXT_TOOL.name).toBe('prepare_task_context');
    expect(PREPARE_TASK_CONTEXT_TOOL.inputSchema.required).toContain('projectId');
    expect(PREPARE_TASK_CONTEXT_TOOL.inputSchema.required).toContain('taskId');
  });

  it('prepare_project_summary requires projectId', () => {
    expect(PREPARE_PROJECT_SUMMARY_TOOL.name).toBe('prepare_project_summary');
    expect(PREPARE_PROJECT_SUMMARY_TOOL.inputSchema.required).toContain('projectId');
  });

  it('create_handoff requires projectId and summary', () => {
    expect(CREATE_HANDOFF_TOOL.name).toBe('create_handoff');
    expect(CREATE_HANDOFF_TOOL.inputSchema.required).toContain('projectId');
    expect(CREATE_HANDOFF_TOOL.inputSchema.required).toContain('summary');
  });
});
