import { Injectable, Logger } from "@nestjs/common";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { optionalEnv } from "@roadboard/config";


interface LatestMainCache {
  sha: string;
  at: string | null;
  fetchedAt: number;
}


interface ReleaseStatus {
  currentSha: string;
  latestMainSha: string | null;
  latestMainAt: string | null;
  hasPending: boolean;
  deploying: boolean;
  lastDeployError: string | null;
}


const LATEST_SHA_TTL_MS = 60_000;


@Injectable()
export class ReleaseService {

  private readonly logger = new Logger(ReleaseService.name);
  private latestMain: LatestMainCache | null = null;

  invalidateLatestMainCache(): void {
    this.latestMain = null;
  }

  async getStatus(): Promise<ReleaseStatus> {

    const currentSha = optionalEnv("BUILD_SHA", "unknown");
    await this.fetchLatestMainSha();
    const latestMainSha = this.latestMain?.sha ?? null;
    const latestMainAt = this.latestMain?.at ?? null;
    const hasPending = latestMainSha !== null && latestMainSha !== currentSha;

    const { deploying, lastDeployError } = await this.readDeployState();

    return {
      currentSha,
      latestMainSha,
      latestMainAt,
      hasPending,
      deploying,
      lastDeployError,
    };
  }

  /**
   * Signal the host-side systemd.path unit to start a deploy by writing a
   * trigger file. The actual git pull + docker compose up runs on the host
   * under roadboard-deploy.service, so it survives the core-api container
   * replacement (the previous in-container approach was killed by docker
   * with exit 137 mid-flight).
   */
  async startDeploy(): Promise<{ accepted: boolean; reason?: string }> {

    const state = await this.readDeployState();

    if (state.deploying) {
      return { accepted: false, reason: "deploy already in progress" };
    }

    const repoPath = optionalEnv("ROADBOARD_REPO_PATH", "/opt/roadboard");
    const triggerPath = join(repoPath, ".deploy-requested");

    try {
      await writeFile(triggerPath, `${new Date().toISOString()}\n`, { flag: "w" });
      this.logger.log(`deploy trigger written at ${triggerPath}`);
      return { accepted: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`failed to write deploy trigger: ${message}`);
      return { accepted: false, reason: `cannot write trigger file: ${message}` };
    }
  }

  private async readDeployState(): Promise<{ deploying: boolean; lastDeployError: string | null }> {

    const repoPath = optionalEnv("ROADBOARD_REPO_PATH", "/opt/roadboard");
    const triggerPath = join(repoPath, ".deploy-requested");
    const errorPath = join(repoPath, ".deploy-error");

    const [triggered, lastDeployError] = await Promise.all([
      readFile(triggerPath, "utf8").then(() => true).catch(() => false),
      readFile(errorPath, "utf8").then((c) => c.trim() || null).catch(() => null),
    ]);

    return { deploying: triggered, lastDeployError };
  }

  private async fetchLatestMainSha(): Promise<string | null> {

    const now = Date.now();

    if (this.latestMain && now - this.latestMain.fetchedAt < LATEST_SHA_TTL_MS) {
      return this.latestMain.sha;
    }

    const repo = optionalEnv("GITHUB_REPO", "Maless88/Roadboard");
    const branch = optionalEnv("ROADBOARD_DEPLOY_BRANCH", "main");
    const url = `https://api.github.com/repos/${repo}/commits/${branch}`;

    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "roadboard-core-api",
      };

      const token = optionalEnv("GITHUB_READ_TOKEN", "");

      if (token !== "") headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, { headers });

      if (!res.ok) {
        this.logger.warn(`GitHub sha fetch failed: ${res.status}`);
        return this.latestMain?.sha ?? null;
      }

      const data = (await res.json()) as { sha?: string; commit?: { author?: { date?: string } } };

      if (!data.sha) return this.latestMain?.sha ?? null;

      this.latestMain = {
        sha: data.sha,
        at: data.commit?.author?.date ?? null,
        fetchedAt: now,
      };
      return data.sha;
    } catch (err) {
      this.logger.warn(`GitHub sha fetch error: ${(err as Error).message}`);
      return this.latestMain?.sha ?? null;
    }
  }
}
