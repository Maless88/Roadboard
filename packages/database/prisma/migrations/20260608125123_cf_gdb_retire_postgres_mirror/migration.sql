-- CF-GDB-03b-E: retire Postgres architecture mirror.
-- Memgraph is the single source of truth for the CodeFlow graph after CF-GDB-03b-D.
-- Drops the 5 graph/impact tables; architecture_snapshots is intentionally KEPT
-- (relational scan-metadata, Decisione 8).

-- DropForeignKey
ALTER TABLE "architecture_annotations" DROP CONSTRAINT "architecture_annotations_node_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_edges" DROP CONSTRAINT "architecture_edges_from_node_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_edges" DROP CONSTRAINT "architecture_edges_snapshot_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_edges" DROP CONSTRAINT "architecture_edges_to_node_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_links" DROP CONSTRAINT "architecture_links_node_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_nodes" DROP CONSTRAINT "architecture_nodes_domain_group_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_nodes" DROP CONSTRAINT "architecture_nodes_project_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_nodes" DROP CONSTRAINT "architecture_nodes_repository_id_fkey";

-- DropForeignKey
ALTER TABLE "architecture_nodes" DROP CONSTRAINT "architecture_nodes_snapshot_id_fkey";

-- DropForeignKey
ALTER TABLE "impact_analyses" DROP CONSTRAINT "impact_analyses_snapshot_id_fkey";

-- DropForeignKey
ALTER TABLE "impact_analyses" DROP CONSTRAINT "impact_analyses_trigger_node_id_fkey";

-- DropTable
DROP TABLE "architecture_annotations";

-- DropTable
DROP TABLE "architecture_edges";

-- DropTable
DROP TABLE "architecture_links";

-- DropTable
DROP TABLE "architecture_nodes";

-- DropTable
DROP TABLE "impact_analyses";
