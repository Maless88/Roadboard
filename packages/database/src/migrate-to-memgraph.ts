/**
 * OBSOLETE — Memgraph is now the sole source of truth.
 *
 * This was a one-shot Phase-1 migration (CF-GDB-03) that copied the
 * architecture graph from the PostgreSQL mirror tables into Memgraph. Those
 * mirror tables (ArchitectureNode/Edge/Link/Annotation) were dropped in
 * CF-GDB-03b-E, so there is nothing left to migrate. Kept as a tombstone for
 * historical reference; it intentionally performs no work.
 */

export {};


function main(): void {

  console.error(
    'migrate-to-memgraph is OBSOLETE: the Postgres graph mirror tables were ' +
    'dropped in CF-GDB-03b-E. Memgraph is the sole source of truth — nothing to migrate.',
  );
  process.exit(1);
}


main();
