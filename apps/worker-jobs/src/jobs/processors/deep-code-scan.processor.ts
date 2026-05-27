import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { GraphDbClient } from '@roadboard/graph-db';

import { QUEUE_DEEP_CODE_SCAN } from '../queue-names';


export interface DeepCodeScanJobData {
  projectId: string;
  repoPath: string;
  delta?: string[];
}


export interface DeepCodeScanResult {
  filesProcessed: number;
  symbolsCreated: number;
  edgesCreated: number;
  durationMs: number;
}


export interface DeepCodeScanDeps {
  graph?: GraphDbClient;
  listFiles?: (repoPath: string) => string[];
  loadProject?: (files: string[], repoPath: string) => SourceFileLike[];
}


export interface SourceFileLike {
  getFilePath: () => string;
  getClasses: () => SymbolDeclLike[];
  getFunctions: () => SymbolDeclLike[];
  getInterfaces: () => SymbolDeclLike[];
  getTypeAliases: () => SymbolDeclLike[];
  getEnums: () => SymbolDeclLike[];
  getImportDeclarations: () => ImportDeclLike[];
}


export interface SymbolDeclLike {
  getName: () => string | undefined;
  getStartLineNumber: () => number;
  getEndLineNumber?: () => number;
}


export interface ImportDeclLike {
  getModuleSpecifierValue: () => string;
}


interface FileNode {
  id: string;
  projectId: string;
  path: string;
  language: string;
}


interface SymbolNode {
  id: string;
  projectId: string;
  fileId: string;
  name: string;
  fqn: string;
  kind: string;
  startLine: number;
  endLine: number | null;
}


interface ExternalPackageNode {
  id: string;
  projectId: string;
  name: string;
}


interface EdgeRecord {
  fromId: string;
  toId: string;
  type: 'CONTAINS' | 'IMPORTS';
}


const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const BATCH_SIZE = 50;


function shouldScan(file: string): boolean {

  if (file.endsWith('.d.ts')) return false;

  const ext = path.extname(file);
  return SCAN_EXTENSIONS.has(ext);
}


function defaultListFiles(repoPath: string): string[] {

  const out = execSync('git ls-files', { cwd: repoPath, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\n').filter(Boolean).filter(shouldScan);
}


function languageFromPath(p: string): string {

  const ext = path.extname(p);

  if (ext === '.ts' || ext === '.tsx') return 'typescript';

  return 'javascript';
}


function hashId(parts: string[]): string {

  return crypto.createHash('sha1').update(parts.join('::')).digest('hex').slice(0, 24);
}


export function extractExternalPackageName(specifier: string): string | null {

  if (!specifier) return null;

  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;

  if (specifier.startsWith('@roadboard/')) return null;

  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');

    if (parts.length < 2) return null;

    return `${parts[0]}/${parts[1]}`;
  }

  return specifier.split('/')[0];
}


@Processor(QUEUE_DEEP_CODE_SCAN, { concurrency: 1 })
export class DeepCodeScanProcessor extends WorkerHost {

  private readonly logger = new Logger(DeepCodeScanProcessor.name);
  private deps: DeepCodeScanDeps = {};
  private graph: GraphDbClient | null = null;


  setDepsForTest(deps: DeepCodeScanDeps): this {

    this.deps = deps;
    return this;
  }


  private getGraph(): GraphDbClient {

    if (this.deps.graph) return this.deps.graph;

    if (!this.graph) this.graph = new GraphDbClient();

    return this.graph;
  }


  private async loadSourceFiles(files: string[], repoPath: string): Promise<SourceFileLike[]> {

    if (this.deps.loadProject) return this.deps.loadProject(files, repoPath);

    const mod = await import('ts-morph');
    const project = new mod.Project({
      useInMemoryFileSystem: false,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true, noEmit: true, skipLibCheck: true },
    });

    const absolutePaths = files.map((f) => path.resolve(repoPath, f));
    project.addSourceFilesAtPaths(absolutePaths);

    return project.getSourceFiles() as unknown as SourceFileLike[];
  }


  async process(job: Job<DeepCodeScanJobData>): Promise<DeepCodeScanResult> {

    const start = Date.now();
    const { projectId, repoPath, delta } = job.data;

    const fileList = delta && delta.length > 0
      ? delta.filter(shouldScan)
      : (this.deps.listFiles ?? defaultListFiles)(repoPath);

    this.logger.log(`[deep-code-scan] project=${projectId} files=${fileList.length} delta=${Boolean(delta)}`);

    if (fileList.length === 0) {
      return { filesProcessed: 0, symbolsCreated: 0, edgesCreated: 0, durationMs: Date.now() - start };
    }

    const sourceFiles = await this.loadSourceFiles(fileList, repoPath);

    const fileNodes: FileNode[] = [];
    const symbolNodes: SymbolNode[] = [];
    const externalPackages = new Map<string, ExternalPackageNode>();
    const edges: EdgeRecord[] = [];

    for (const sf of sourceFiles) {

      const absPath = sf.getFilePath();
      const relPath = path.relative(repoPath, absPath);
      const fileId = hashId([projectId, 'file', relPath]);

      fileNodes.push({
        id: fileId,
        projectId,
        path: relPath,
        language: languageFromPath(relPath),
      });

      const declGroups: Array<{ kind: string; items: SymbolDeclLike[] }> = [
        { kind: 'class', items: sf.getClasses() },
        { kind: 'function', items: sf.getFunctions() },
        { kind: 'interface', items: sf.getInterfaces() },
        { kind: 'type', items: sf.getTypeAliases() },
        { kind: 'enum', items: sf.getEnums() },
      ];

      for (const { kind, items } of declGroups) {

        for (const decl of items) {

          const name = decl.getName();

          if (!name) continue;

          const fqn = `${relPath}::${name}`;
          const symbolId = hashId([projectId, 'symbol', fqn]);

          symbolNodes.push({
            id: symbolId,
            projectId,
            fileId,
            name,
            fqn,
            kind,
            startLine: decl.getStartLineNumber(),
            endLine: decl.getEndLineNumber ? decl.getEndLineNumber() : null,
          });

          edges.push({ fromId: fileId, toId: symbolId, type: 'CONTAINS' });
        }
      }

      for (const imp of sf.getImportDeclarations()) {

        const spec = imp.getModuleSpecifierValue();
        const pkgName = extractExternalPackageName(spec);

        if (!pkgName) continue;

        const pkgId = hashId([projectId, 'pkg', pkgName]);

        if (!externalPackages.has(pkgId)) {
          externalPackages.set(pkgId, { id: pkgId, projectId, name: pkgName });
        }

        edges.push({ fromId: fileId, toId: pkgId, type: 'IMPORTS' });
      }
    }

    const graph = this.getGraph();

    await this.flushFileNodes(graph, fileNodes);
    await this.flushSymbolNodes(graph, symbolNodes);
    await this.flushExternalPackages(graph, Array.from(externalPackages.values()));
    await this.flushEdges(graph, edges);

    const result: DeepCodeScanResult = {
      filesProcessed: fileNodes.length,
      symbolsCreated: symbolNodes.length,
      edgesCreated: edges.length,
      durationMs: Date.now() - start,
    };

    this.logger.log(
      `[deep-code-scan] project=${projectId} done files=${result.filesProcessed} ` +
      `symbols=${result.symbolsCreated} edges=${result.edgesCreated} ms=${result.durationMs}`,
    );

    return result;
  }


  private async flushFileNodes(graph: GraphDbClient, nodes: FileNode[]): Promise<void> {

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      await graph.run(
        `UNWIND $rows AS row
         MERGE (f:File {id: row.id})
         SET f.projectId = row.projectId, f.path = row.path, f.language = row.language`,
        { rows: chunk },
        { mode: 'write' },
      );
    }
  }


  private async flushSymbolNodes(graph: GraphDbClient, nodes: SymbolNode[]): Promise<void> {

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      await graph.run(
        `UNWIND $rows AS row
         MERGE (s:Symbol {id: row.id})
         SET s.projectId = row.projectId, s.fileId = row.fileId, s.name = row.name,
             s.fqn = row.fqn, s.kind = row.kind, s.startLine = row.startLine, s.endLine = row.endLine`,
        { rows: chunk },
        { mode: 'write' },
      );
    }
  }


  private async flushExternalPackages(graph: GraphDbClient, nodes: ExternalPackageNode[]): Promise<void> {

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const chunk = nodes.slice(i, i + BATCH_SIZE);
      await graph.run(
        `UNWIND $rows AS row
         MERGE (p:ExternalPackage {id: row.id})
         SET p.projectId = row.projectId, p.name = row.name`,
        { rows: chunk },
        { mode: 'write' },
      );
    }
  }


  private async flushEdges(graph: GraphDbClient, edges: EdgeRecord[]): Promise<void> {

    const byType = new Map<string, EdgeRecord[]>();

    for (const e of edges) {
      const bucket = byType.get(e.type) ?? [];
      bucket.push(e);
      byType.set(e.type, bucket);
    }

    for (const [type, list] of byType) {

      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const chunk = list.slice(i, i + BATCH_SIZE);
        await graph.run(
          `UNWIND $rows AS row
           MATCH (a {id: row.fromId}), (b {id: row.toId})
           MERGE (a)-[:${type}]->(b)`,
          { rows: chunk },
          { mode: 'write' },
        );
      }
    }
  }
}
