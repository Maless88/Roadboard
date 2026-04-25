import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReleaseService } from './release.service';


function mockGithubCommit(sha: string, at: string | null = null): void {

  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    async json() {
      return { sha, commit: at ? { author: { date: at } } : undefined };
    },
  } as unknown as Response)));
}


describe('ReleaseService', () => {

  let repoPath: string;
  let service: ReleaseService;

  beforeEach(() => {

    repoPath = mkdtempSync(join(tmpdir(), 'rb-release-'));
    process.env.ROADBOARD_REPO_PATH = repoPath;
    process.env.BUILD_SHA = 'aaaa111';
    process.env.GITHUB_REPO = 'owner/repo';
    process.env.ROADBOARD_DEPLOY_BRANCH = 'main';
    service = new ReleaseService();
  });


  afterEach(() => {

    rmSync(repoPath, { recursive: true, force: true });
    delete process.env.ROADBOARD_REPO_PATH;
    delete process.env.BUILD_SHA;
    delete process.env.GITHUB_REPO;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });


  it('getStatus: hasPending=true when latestMainSha differs from BUILD_SHA', async () => {

    mockGithubCommit('bbbb222', '2026-04-24T10:00:00Z');

    const status = await service.getStatus();

    expect(status.currentSha).toBe('aaaa111');
    expect(status.latestMainSha).toBe('bbbb222');
    expect(status.latestMainAt).toBe('2026-04-24T10:00:00Z');
    expect(status.hasPending).toBe(true);
    expect(status.deploying).toBe(false);
    expect(status.lastDeployError).toBeNull();
  });


  it('getStatus: hasPending=false when shas match', async () => {

    mockGithubCommit('aaaa111', '2026-04-24T10:00:00Z');

    const status = await service.getStatus();

    expect(status.hasPending).toBe(false);
  });


  it('getStatus: caches latestMainSha within TTL (single fetch)', async () => {

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      async json() { return { sha: 'cccc333', commit: { author: { date: '2026-04-24T11:00:00Z' } } }; },
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchSpy);

    await service.getStatus();
    await service.getStatus();
    await service.getStatus();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });


  it('startDeploy writes the trigger file to repoPath', async () => {

    mockGithubCommit('eeee555');

    const result = await service.startDeploy();

    expect(result.accepted).toBe(true);
    const triggerPath = join(repoPath, '.deploy-requested');
    expect(existsSync(triggerPath)).toBe(true);
    const content = readFileSync(triggerPath, 'utf8').trim();
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });


  it('startDeploy refuses if a deploy is already in progress (trigger file exists)', async () => {

    writeFileSync(join(repoPath, '.deploy-requested'), 'previous\n');

    const result = await service.startDeploy();

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('already in progress');
  });


  it('getStatus reports deploying=true while the trigger file exists', async () => {

    mockGithubCommit('ffff666');
    writeFileSync(join(repoPath, '.deploy-requested'), 'now\n');

    const status = await service.getStatus();

    expect(status.deploying).toBe(true);
  });


  it('getStatus surfaces .deploy-error content as lastDeployError', async () => {

    mockGithubCommit('7777777');
    writeFileSync(join(repoPath, '.deploy-error'), '  something went wrong  \n');

    const status = await service.getStatus();

    expect(status.lastDeployError).toBe('something went wrong');
  });


  it('getStatus: returns latestMainSha=null when GitHub is unreachable and no cache exists', async () => {

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 } as unknown as Response)));

    const status = await service.getStatus();

    expect(status.latestMainSha).toBeNull();
    expect(status.hasPending).toBe(false);
  });
});
