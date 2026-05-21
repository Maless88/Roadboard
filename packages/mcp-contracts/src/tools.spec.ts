import { describe, it, expect } from 'vitest';

import {
  MCP_TOOLS,
  CREATE_PROJECT_TOOL,
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
  GET_PROJECT_CHANGELOG_TOOL,
  SEARCH_MEMORY_TOOL,
  GET_ARCHITECTURE_MAP_TOOL,
  GET_NODE_CONTEXT_TOOL,
  GET_ARCHITECTURE_SNAPSHOT_TOOL,
  CREATE_ARCHITECTURE_REPOSITORY_TOOL,
  CREATE_ARCHITECTURE_NODE_TOOL,
  CREATE_ARCHITECTURE_EDGE_TOOL,
  CREATE_ARCHITECTURE_LINK_TOOL,
  CREATE_ARCHITECTURE_ANNOTATION_TOOL,
  INGEST_ARCHITECTURE_TOOL,
  LINK_TASK_TO_NODE_TOOL,
  type ArchitectureSnapshot,
} from './tools';
import { LEGACY_TITLE_REGEX, checkLegacyTitle } from './naming';


describe('MCP_TOOLS', () => {

  it('exports exactly 25 tools', () => {
    expect(MCP_TOOLS).toHaveLength(25);
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


describe('changelog and search tools', () => {

  it('get_project_changelog requires projectId', () => {
    expect(GET_PROJECT_CHANGELOG_TOOL.name).toBe('get_project_changelog');
    expect(GET_PROJECT_CHANGELOG_TOOL.inputSchema.required).toContain('projectId');
  });

  it('search_memory requires projectId and q', () => {
    expect(SEARCH_MEMORY_TOOL.name).toBe('search_memory');
    expect(SEARCH_MEMORY_TOOL.inputSchema.required).toContain('projectId');
    expect(SEARCH_MEMORY_TOOL.inputSchema.required).toContain('q');
  });
});


describe('project management tools', () => {

  it('create_project requires name, slug and ownerTeamId', () => {
    expect(CREATE_PROJECT_TOOL.name).toBe('create_project');
    expect(CREATE_PROJECT_TOOL.inputSchema.required).toContain('name');
    expect(CREATE_PROJECT_TOOL.inputSchema.required).toContain('slug');
    expect(CREATE_PROJECT_TOOL.inputSchema.required).toContain('ownerTeamId');
  });
});


describe('task naming convention', () => {

  describe('LEGACY_TITLE_REGEX — positive matches (legacy titles)', () => {

    it('matches bracket+code prefix: [CF-GDB-03b-7]', () => {
      expect(LEGACY_TITLE_REGEX.test('[CF-GDB-03b-7] Test outbox')).toBe(true);
    });

    it('matches bracket+code prefix: [CF-17R]', () => {
      expect(LEGACY_TITLE_REGEX.test('[CF-17R] Impact view')).toBe(true);
    });

    it('matches bare code prefix with em-dash: CF-17R —', () => {
      expect(LEGACY_TITLE_REGEX.test('CF-17R — Impact view generalizzata')).toBe(true);
    });

    it('matches bracket+short code: [W4-06]', () => {
      expect(LEGACY_TITLE_REGEX.test('[W4-06] web-app: invite flow')).toBe(true);
    });

    it('matches lowercase code prefix: audit-01:', () => {
      expect(LEGACY_TITLE_REGEX.test('audit-01: popolare AuditEvent')).toBe(true);
    });

    it('matches code without brackets or separator', () => {
      expect(LEGACY_TITLE_REGEX.test('CF-AGENT-01c description here')).toBe(true);
    });
  });


  describe('LEGACY_TITLE_REGEX — negative matches (compliant titles)', () => {

    it('does not match "Area — description" format', () => {
      expect(LEGACY_TITLE_REGEX.test('Atlas — Impact view generalizzata')).toBe(false);
    });

    it('does not match Memgraph area prefix', () => {
      expect(LEGACY_TITLE_REGEX.test('Memgraph — Swap reads to graph DB')).toBe(false);
    });

    it('does not match "Settings → tab Usage: consumo token"', () => {
      expect(LEGACY_TITLE_REGEX.test('Settings → tab Usage: consumo token per utente')).toBe(false);
    });

    it('does not match plain prose title', () => {
      expect(LEGACY_TITLE_REGEX.test('Fix login button color on mobile')).toBe(false);
    });

    it('does not match "UX & Vibe Coding — ..."', () => {
      expect(LEGACY_TITLE_REGEX.test('UX & Vibe Coding — Empty state per lista task vuota')).toBe(false);
    });
  });


  describe('checkLegacyTitle — warning shape', () => {

    it('returns null for compliant title', () => {
      expect(checkLegacyTitle('Atlas — Gruppi di dominio (CRUD)')).toBeNull();
    });

    it('returns a warning string for legacy title', () => {
      const warning = checkLegacyTitle('[CF-XX-01] Fix something');
      expect(typeof warning).toBe('string');
      expect(warning).toContain('legacy code');
      expect(warning).toContain('Area — description');
      expect(warning).toContain('docs/task-naming-convention.md');
    });

    it('warning includes the offending title', () => {
      const title = 'CF-17R — Impact view';
      const warning = checkLegacyTitle(title);
      expect(warning).toContain(title);
    });

    it('returns null for Memgraph area title', () => {
      expect(checkLegacyTitle('Memgraph — Estendi mirror a Link')).toBeNull();
    });
  });


  describe('create_task tool — naming guidance in description and schema', () => {

    it('description contains naming convention instruction', () => {
      expect(CREATE_TASK_TOOL.description).toContain('Area — description');
    });

    it('description contains positive examples', () => {
      expect(CREATE_TASK_TOOL.description).toContain('Atlas — Gruppi di dominio (CRUD)');
    });

    it('title field description warns against legacy codes', () => {
      const props = CREATE_TASK_TOOL.inputSchema.properties as Record<string, { description: string }>;
      expect(props.title.description).toContain('Area — description');
      expect(props.title.description).toContain('CF-XX-YY');
    });
  });
});


describe('codeflow tools', () => {

  it('get_architecture_map requires projectId', () => {
    expect(GET_ARCHITECTURE_MAP_TOOL.name).toBe('get_architecture_map');
    expect(GET_ARCHITECTURE_MAP_TOOL.inputSchema.required).toContain('projectId');
  });

  it('get_node_context requires projectId and nodeId', () => {
    expect(GET_NODE_CONTEXT_TOOL.name).toBe('get_node_context');
    expect(GET_NODE_CONTEXT_TOOL.inputSchema.required).toContain('projectId');
    expect(GET_NODE_CONTEXT_TOOL.inputSchema.required).toContain('nodeId');
  });

  it('create_architecture_repository requires projectId and name', () => {
    expect(CREATE_ARCHITECTURE_REPOSITORY_TOOL.name).toBe('create_architecture_repository');
    expect(CREATE_ARCHITECTURE_REPOSITORY_TOOL.inputSchema.required).toEqual(['projectId', 'name']);
  });

  it('create_architecture_node requires projectId, repositoryId, type, name', () => {
    expect(CREATE_ARCHITECTURE_NODE_TOOL.name).toBe('create_architecture_node');
    expect(CREATE_ARCHITECTURE_NODE_TOOL.inputSchema.required).toEqual(['projectId', 'repositoryId', 'type', 'name']);
  });

  it('create_architecture_edge requires projectId, fromNodeId, toNodeId, edgeType', () => {
    expect(CREATE_ARCHITECTURE_EDGE_TOOL.name).toBe('create_architecture_edge');
    expect(CREATE_ARCHITECTURE_EDGE_TOOL.inputSchema.required).toEqual(['projectId', 'fromNodeId', 'toNodeId', 'edgeType']);
  });

  it('create_architecture_link requires projectId, nodeId, entityType, entityId, linkType', () => {
    expect(CREATE_ARCHITECTURE_LINK_TOOL.name).toBe('create_architecture_link');
    expect(CREATE_ARCHITECTURE_LINK_TOOL.inputSchema.required).toEqual(['projectId', 'nodeId', 'entityType', 'entityId', 'linkType']);
  });

  it('create_architecture_annotation requires projectId, nodeId, content', () => {
    expect(CREATE_ARCHITECTURE_ANNOTATION_TOOL.name).toBe('create_architecture_annotation');
    expect(CREATE_ARCHITECTURE_ANNOTATION_TOOL.inputSchema.required).toEqual(['projectId', 'nodeId', 'content']);
  });

  it('ingest_architecture requires projectId, repository, nodes', () => {
    expect(INGEST_ARCHITECTURE_TOOL.name).toBe('ingest_architecture');
    expect(INGEST_ARCHITECTURE_TOOL.inputSchema.required).toEqual(['projectId', 'repository', 'nodes']);
  });

  it('link_task_to_node requires projectId, taskId, nodeId', () => {
    expect(LINK_TASK_TO_NODE_TOOL.name).toBe('link_task_to_node');
    expect(LINK_TASK_TO_NODE_TOOL.inputSchema.required).toEqual(['projectId', 'taskId', 'nodeId']);
  });

  it('get_architecture_snapshot requires projectId only', () => {
    expect(GET_ARCHITECTURE_SNAPSHOT_TOOL.name).toBe('get_architecture_snapshot');
    expect(GET_ARCHITECTURE_SNAPSHOT_TOOL.inputSchema.required).toEqual(['projectId']);
  });

  it('get_architecture_snapshot is listed in MCP_TOOLS', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toContain('get_architecture_snapshot');
  });
});


describe('ArchitectureSnapshot contract', () => {

  it('satisfies the compact contract shape', () => {

    const sample: ArchitectureSnapshot = {
      projectId: 'proj-1',
      generatedAt: new Date().toISOString(),
      nodeCount: 3,
      edgeCount: 2,
      summary: {
        nodesByType: { app: 2, package: 1 },
        edgesByType: { depends_on: 2 },
      },
      topImpactNodes: [
        { nodeId: 'n1', name: 'domain', type: 'package', directDependants: 2 },
      ],
      recentAnnotations: [
        {
          nodeId: 'n1',
          nodeName: 'domain',
          content: 'Core shared package',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    };

    expect(sample.projectId).toBe('proj-1');
    expect(sample.topImpactNodes).toHaveLength(1);
    expect(sample.recentAnnotations).toHaveLength(1);
    expect(sample.summary.nodesByType).toEqual({ app: 2, package: 1 });
  });
});
