import { GraphDbClient } from './client';


const SCHEMA_CYPHER: string[] = [
  // Uniqueness constraints on node ids
  'CREATE CONSTRAINT ON (n:App) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Package) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Module) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Service) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Repository) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Link) ASSERT n.id IS UNIQUE;',
  'CREATE CONSTRAINT ON (n:Annotation) ASSERT n.id IS UNIQUE;',

  // Performance indexes on frequently queried attributes
  'CREATE INDEX ON :App(projectId);',
  'CREATE INDEX ON :Package(projectId);',
  'CREATE INDEX ON :Module(projectId);',
  'CREATE INDEX ON :Service(projectId);',
  'CREATE INDEX ON :App(name);',
  'CREATE INDEX ON :Package(name);',
  'CREATE INDEX ON :Repository(projectId);',
  'CREATE INDEX ON :Link(projectId);',
  'CREATE INDEX ON :Link(entityType);',
  'CREATE INDEX ON :Link(entityId);',
  'CREATE INDEX ON :Annotation(projectId);',
  'CREATE INDEX ON :Annotation(nodeId);',
];


/**
 * Apply the CodeFlow schema (constraints + indexes) to Memgraph.
 * Safe to re-run: Memgraph ignores duplicate constraint/index creations.
 */
export async function applyGraphSchema(client: GraphDbClient): Promise<void> {

  for (const stmt of SCHEMA_CYPHER) {

    try {
      await client.run(stmt, {}, { mode: 'write' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (/already exists|Constraint.*exists/i.test(msg)) continue;

      throw err;
    }
  }
}


export const NODE_LABELS = [
  'App',
  'Package',
  'Module',
  'Service',
  'Repository',
  'Link',
  'Annotation',
] as const;
export const EDGE_TYPES = [
  'DEPENDS_ON',
  'IMPORTS',
  'IMPACTS',
  'LINKED_TO',
  'ANNOTATES',
  'BELONGS_TO',
] as const;

export type NodeLabel = typeof NODE_LABELS[number];
export type EdgeType = typeof EDGE_TYPES[number];


export function labelFromType(type: string): NodeLabel {

  const normalized = type.toLowerCase();

  if (normalized === 'app') return 'App';

  if (normalized === 'package') return 'Package';

  if (normalized === 'module') return 'Module';

  if (normalized === 'service') return 'Service';

  return 'Module';
}
