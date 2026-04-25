import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GraphDbClient } from '@roadboard/graph-db';
import { createHash } from 'node:crypto';


type EntityType = 'node' | 'edge' | 'link' | 'annotation' | 'repository';


export interface EntityDriftReport {
  type: EntityType;
  postgresCount: number;
  memgraphCount: number;
  postgresHash: string;
  memgraphHash: string;
  inSync: boolean;
  missingInMemgraph: string[];
  extraInMemgraph: string[];
}


export interface DriftReport {
  generatedAt: string;
  reachable: boolean;
  entities: EntityDriftReport[];
  totalDrift: number;
}


function md5OfSortedIds(ids: string[]): string {

  const sorted = [...ids].sort();
  return createHash('md5').update(sorted.join(',')).digest('hex');
}


/**
 * Compares Postgres state vs Memgraph projection and reports drift.
 * Used by the admin /codeflow/.../drift endpoint and by the host-side
 * drift-check.service systemd timer (CF-GDB-03c).
 */
@Injectable()
export class DriftService {

  private readonly logger = new Logger(DriftService.name);

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Optional() @Inject('GRAPH_DB_CLIENT') private readonly graph?: GraphDbClient,
  ) {}


  async detectDrift(): Promise<DriftReport> {

    const generatedAt = new Date().toISOString();

    if (!this.graph) {
      return { generatedAt, reachable: false, entities: [], totalDrift: 0 };
    }

    const reachable = await this.graph.ping().catch(() => false);

    if (!reachable) {
      return { generatedAt, reachable: false, entities: [], totalDrift: 0 };
    }

    const entities: EntityDriftReport[] = await Promise.all([
      this.checkNodes(),
      this.checkEdges(),
      this.checkLinks(),
      this.checkAnnotations(),
      this.checkRepositories(),
    ]);

    const totalDrift = entities.reduce((acc, e) => acc + (e.inSync ? 0 : 1), 0);

    return { generatedAt, reachable: true, entities, totalDrift };
  }


  private async checkNodes(): Promise<EntityDriftReport> {

    const pgRows = await this.prisma.architectureNode.findMany({
      where: { isCurrent: true }, select: { id: true },
    });
    const pgIds = pgRows.map((r) => r.id);
    const mgRows = await this.graph!.run<{ id: string }>(
      'MATCH (n) WHERE NOT n:Link AND NOT n:Annotation AND NOT n:Repository RETURN n.id AS id',
    );
    return this.buildReport('node', pgIds, mgRows.map((r) => r.id));
  }


  private async checkEdges(): Promise<EntityDriftReport> {

    const pgRows = await this.prisma.architectureEdge.findMany({
      where: { isCurrent: true }, select: { id: true },
    });
    const mgRows = await this.graph!.run<{ id: string }>(
      'MATCH ()-[r]->() WHERE r.id IS NOT NULL AND type(r) <> "LINKED_TO" AND type(r) <> "ANNOTATES" RETURN r.id AS id',
    );
    return this.buildReport('edge', pgRows.map((r) => r.id), mgRows.map((r) => r.id));
  }


  private async checkLinks(): Promise<EntityDriftReport> {

    const pgRows = await this.prisma.architectureLink.findMany({ select: { id: true } });
    const mgRows = await this.graph!.run<{ id: string }>(
      'MATCH (l:Link) RETURN l.id AS id',
    );
    return this.buildReport('link', pgRows.map((r) => r.id), mgRows.map((r) => r.id));
  }


  private async checkAnnotations(): Promise<EntityDriftReport> {

    const pgRows = await this.prisma.architectureAnnotation.findMany({ select: { id: true } });
    const mgRows = await this.graph!.run<{ id: string }>(
      'MATCH (a:Annotation) RETURN a.id AS id',
    );
    return this.buildReport('annotation', pgRows.map((r) => r.id), mgRows.map((r) => r.id));
  }


  private async checkRepositories(): Promise<EntityDriftReport> {

    const pgRows = await this.prisma.codeRepository.findMany({ select: { id: true } });
    const mgRows = await this.graph!.run<{ id: string }>(
      'MATCH (r:Repository) RETURN r.id AS id',
    );
    return this.buildReport('repository', pgRows.map((r) => r.id), mgRows.map((r) => r.id));
  }


  private buildReport(type: EntityType, pgIds: string[], mgIds: string[]): EntityDriftReport {

    const pgSet = new Set(pgIds);
    const mgSet = new Set(mgIds);
    const missingInMemgraph = pgIds.filter((id) => !mgSet.has(id)).slice(0, 5);
    const extraInMemgraph = mgIds.filter((id) => !pgSet.has(id)).slice(0, 5);
    const postgresHash = md5OfSortedIds(pgIds);
    const memgraphHash = md5OfSortedIds(mgIds);
    const inSync = pgIds.length === mgIds.length && postgresHash === memgraphHash;

    return {
      type,
      postgresCount: pgIds.length,
      memgraphCount: mgIds.length,
      postgresHash,
      memgraphHash,
      inSync,
      missingInMemgraph,
      extraInMemgraph,
    };
  }
}
