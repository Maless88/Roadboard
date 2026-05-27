import { describe, it, expect, vi } from 'vitest';

import {
  DeepCodeScanProcessor,
  extractExternalPackageName,
  type SourceFileLike,
} from './deep-code-scan.processor';


function fakeGraph(): { run: ReturnType<typeof vi.fn>; calls: Array<{ cypher: string; params: Record<string, unknown> }> } {

  const calls: Array<{ cypher: string; params: Record<string, unknown> }> = [];
  const run = vi.fn().mockImplementation(async (cypher: string, params: Record<string, unknown>) => {
    calls.push({ cypher, params });
    return [];
  });

  return { run, calls };
}


function makeSourceFile(opts: {
  path: string;
  classes?: string[];
  functions?: string[];
  interfaces?: string[];
  typeAliases?: string[];
  enums?: string[];
  imports?: string[];
}): SourceFileLike {

  const decl = (name: string) => ({
    getName: () => name,
    getStartLineNumber: () => 1,
    getEndLineNumber: () => 10,
  });

  return {
    getFilePath: () => opts.path,
    getClasses: () => (opts.classes ?? []).map(decl),
    getFunctions: () => (opts.functions ?? []).map(decl),
    getInterfaces: () => (opts.interfaces ?? []).map(decl),
    getTypeAliases: () => (opts.typeAliases ?? []).map(decl),
    getEnums: () => (opts.enums ?? []).map(decl),
    getImportDeclarations: () => (opts.imports ?? []).map((spec) => ({ getModuleSpecifierValue: () => spec })),
  };
}


describe('extractExternalPackageName', () => {

  it('returns null for relative imports', () => {

    expect(extractExternalPackageName('./foo')).toBeNull();
    expect(extractExternalPackageName('../bar/baz')).toBeNull();
    expect(extractExternalPackageName('/absolute/path')).toBeNull();
  });


  it('returns null for workspace aliases', () => {

    expect(extractExternalPackageName('@roadboard/domain')).toBeNull();
    expect(extractExternalPackageName('@roadboard/graph-db')).toBeNull();
  });


  it('extracts bare package names', () => {

    expect(extractExternalPackageName('react')).toBe('react');
    expect(extractExternalPackageName('lodash/fp')).toBe('lodash');
  });


  it('extracts scoped package names', () => {

    expect(extractExternalPackageName('@nestjs/common')).toBe('@nestjs/common');
    expect(extractExternalPackageName('@nestjs/common/decorators/foo')).toBe('@nestjs/common');
  });
});


describe('DeepCodeScanProcessor', () => {

  it('returns empty result when no files match', async () => {

    const graph = fakeGraph();
    const proc = new DeepCodeScanProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graph: graph as any,
      listFiles: () => [],
      loadProject: () => [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await proc.process({ data: { projectId: 'p1', repoPath: '/repo' } } as any);

    expect(result.filesProcessed).toBe(0);
    expect(result.symbolsCreated).toBe(0);
    expect(result.edgesCreated).toBe(0);
    expect(typeof result.durationMs).toBe('number');
    expect(graph.run).not.toHaveBeenCalled();
  });


  it('extracts files, symbols, external packages and edges', async () => {

    const graph = fakeGraph();

    const sf = makeSourceFile({
      path: '/repo/src/foo.ts',
      classes: ['Foo'],
      functions: ['doIt'],
      interfaces: ['IFoo'],
      typeAliases: ['FooType'],
      enums: ['FooEnum'],
      imports: ['react', '@nestjs/common', '@roadboard/domain', './local'],
    });

    const proc = new DeepCodeScanProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graph: graph as any,
      listFiles: () => ['src/foo.ts'],
      loadProject: () => [sf],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await proc.process({ data: { projectId: 'p1', repoPath: '/repo' } } as any);

    expect(result.filesProcessed).toBe(1);
    expect(result.symbolsCreated).toBe(5);
    // 5 CONTAINS edges + 2 IMPORTS edges (react, @nestjs/common) — workspace and relative skipped
    expect(result.edgesCreated).toBe(7);

    // Verify Cypher calls happened
    const cyphers = graph.calls.map((c) => c.cypher);
    expect(cyphers.some((c) => /MERGE \(f:File/i.test(c))).toBe(true);
    expect(cyphers.some((c) => /MERGE \(s:Symbol/i.test(c))).toBe(true);
    expect(cyphers.some((c) => /MERGE \(p:ExternalPackage/i.test(c))).toBe(true);
    expect(cyphers.some((c) => /CONTAINS/.test(c))).toBe(true);
    expect(cyphers.some((c) => /IMPORTS/.test(c))).toBe(true);

    // Verify File node payload shape
    const fileCall = graph.calls.find((c) => /MERGE \(f:File/i.test(c.cypher));
    expect(fileCall).toBeTruthy();
    const fileRows = (fileCall!.params.rows as Array<{ path: string; language: string; projectId: string }>);
    expect(fileRows[0].path).toBe('src/foo.ts');
    expect(fileRows[0].language).toBe('typescript');
    expect(fileRows[0].projectId).toBe('p1');

    // Verify external packages
    const pkgCall = graph.calls.find((c) => /MERGE \(p:ExternalPackage/i.test(c.cypher));
    const pkgRows = (pkgCall!.params.rows as Array<{ name: string }>);
    const pkgNames = pkgRows.map((r) => r.name).sort();
    expect(pkgNames).toEqual(['@nestjs/common', 'react']);
  });


  it('honors delta list and skips git ls-files', async () => {

    const graph = fakeGraph();
    const listFiles = vi.fn().mockReturnValue(['should-not-be-used.ts']);

    const sf = makeSourceFile({ path: '/repo/changed.ts', functions: ['handler'] });

    const proc = new DeepCodeScanProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graph: graph as any,
      listFiles,
      loadProject: (files) => {
        expect(files).toEqual(['changed.ts']);
        return [sf];
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await proc.process({ data: { projectId: 'p1', repoPath: '/repo', delta: ['changed.ts'] } } as any);

    expect(listFiles).not.toHaveBeenCalled();
    expect(result.filesProcessed).toBe(1);
    expect(result.symbolsCreated).toBe(1);
  });


  it('filters delta to only ts/tsx/js/jsx files', async () => {

    const graph = fakeGraph();
    const loadProject = vi.fn().mockReturnValue([]);

    const proc = new DeepCodeScanProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graph: graph as any,
      loadProject,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await proc.process({
      data: { projectId: 'p1', repoPath: '/repo', delta: ['a.md', 'b.ts', 'c.tsx', 'd.txt', 'e.d.ts'] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const [files] = loadProject.mock.calls[0];
    expect(files).toEqual(['b.ts', 'c.tsx']);
  });


  it('batches large numbers of nodes in chunks of 50', async () => {

    const graph = fakeGraph();

    const sourceFiles: SourceFileLike[] = [];
    for (let i = 0; i < 120; i++) {
      sourceFiles.push(makeSourceFile({ path: `/repo/f${i}.ts` }));
    }

    const proc = new DeepCodeScanProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graph: graph as any,
      listFiles: () => sourceFiles.map((_, i) => `f${i}.ts`),
      loadProject: () => sourceFiles,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await proc.process({ data: { projectId: 'p1', repoPath: '/repo' } } as any);

    expect(result.filesProcessed).toBe(120);

    // File flush should have 3 batches (50 + 50 + 20)
    const fileCalls = graph.calls.filter((c) => /MERGE \(f:File/i.test(c.cypher));
    expect(fileCalls).toHaveLength(3);
    expect((fileCalls[0].params.rows as unknown[]).length).toBe(50);
    expect((fileCalls[1].params.rows as unknown[]).length).toBe(50);
    expect((fileCalls[2].params.rows as unknown[]).length).toBe(20);
  });
});
