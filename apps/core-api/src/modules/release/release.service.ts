import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { optionalEnv } from "@roadboard/config";


interface LatestMainCache {
  sha: string;
  fetchedAt: number;
}


interface ReleaseStatus {
  currentSha: string;
  latestMainSha: string | null;
  hasPending: boolean;
  deploying: boolean;
  lastDeployError: string | null;
}


const LATEST_SHA_TTL_MS = 60_000;


@Injectable()
export class ReleaseService {

  private readonly logger = new Logger(ReleaseService.name);
  private latestMain: LatestMainCache | null = null;
  private deploying = false;
  private lastDeployError: string | null = null;

  invalidateLatestMainCache(): void {
    this.latestMain = null;
  }

  async getStatus(): Promise<ReleaseStatus> {

    const currentSha = optionalEnv("BUILD_SHA", "unknown");
    const latestMainSha = await this.fetchLatestMainSha();
    const hasPending = latestMainSha !== null && latestMainSha !== currentSha;

    return {
      currentSha,
      latestMainSha,
      hasPending,
      deploying: this.deploying,
      lastDeployError: this.lastDeployError,
    };
  }

  isDeploying(): boolean {
    return this.deploying;
  }

  startDeploy(): { accepted: boolean; reason?: string } {

    if (this.deploying) {
      return { accepted: false, reason: "deploy already in progress" };
    }

    const repoPath = optionalEnv("ROADBOARD_REPO_PATH", "/opt/roadboard");
    const composeFile = optionalEnv(
      "ROADBOARD_COMPOSE_FILE",
      "infra/docker/docker-compose.yml",
    );
    const branch = optionalEnv("ROADBOARD_DEPLOY_BRANCH", "main");

    this.deploying = true;
    this.lastDeployError = null;

    // safe.directory=* disables git's ownership check: the repo on host is
    // owned by the non-root user while this container runs as root.
    const gitSafe = `-c safe.directory=${repoPath}`;
    const cmd = `cd ${repoPath} && git ${gitSafe} fetch --all --prune && git ${gitSafe} checkout ${branch} && git ${gitSafe} pull --ff-only origin ${branch} && docker compose -f ${composeFile} up -d --build`;

    this.logger.log(`starting deploy: ${cmd}`);

    const child = spawn("bash", ["-lc", cmd], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const emitter = child as unknown as EventEmitter;
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      this.logger.log(`[deploy stdout] ${chunk.toString().trim()}`);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      this.logger.warn(`[deploy stderr] ${text.trim()}`);
    });

    emitter.on("exit", (code: number | null) => {

      if (code === 0) {
        this.logger.log("deploy completed; container will be replaced shortly");
      } else {
        this.deploying = false;
        this.lastDeployError = stderr.trim().slice(-500) || `exit code ${code}`;
        this.logger.error(`deploy failed with code ${code}`);
      }
    });

    emitter.on("error", (err: Error) => {
      this.deploying = false;
      this.lastDeployError = err.message;
      this.logger.error(`deploy spawn error: ${err.message}`);
    });

    child.unref();

    return { accepted: true };
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

      const data = (await res.json()) as { sha?: string };

      if (!data.sha) return this.latestMain?.sha ?? null;

      this.latestMain = { sha: data.sha, fetchedAt: now };
      return data.sha;
    } catch (err) {
      this.logger.warn(`GitHub sha fetch error: ${(err as Error).message}`);
      return this.latestMain?.sha ?? null;
    }
  }
}
