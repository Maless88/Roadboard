/**
 * OBSOLETE — Memgraph is now the sole source of truth.
 *
 * This was a one-shot backfill that enqueued `graph_sync_events` from the
 * PostgreSQL graph mirror tables (ArchitectureNode/Edge/Link/Annotation) so the
 * dual-write outbox worker could replay them into Memgraph. Those mirror tables
 * were dropped in CF-GDB-03b-E, so there is no Postgres graph state left to
 * backfill. Kept as a tombstone for historical reference; it performs no work.
 */

export {};


function main(): void {

  console.error(
    'backfill-outbox is OBSOLETE: the Postgres graph mirror tables were dropped ' +
    'in CF-GDB-03b-E. Memgraph is the sole source of truth — nothing to backfill.',
  );
  process.exit(1);
}


main();
