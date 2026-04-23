import { Body, Controller, ForbiddenException, Get, Headers, HttpException, HttpStatus, Post } from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";

import { ReleaseService } from "./release.service";


interface ReleasePendingBody {
  sha: string;
}


interface ReleaseStatusResponse {
  current: string;
  pending: { sha: string; at: string } | null;
  hasPending: boolean;
  deployUrl: string;
}


interface TriggerDeployResponse {
  ok: true;
  ref: string;
}


@Controller()
export class ReleaseController {

  constructor(private readonly release: ReleaseService) {}

  @Get("release-status")
  getStatus(): ReleaseStatusResponse {

    const current = optionalEnv("BUILD_SHA", "unknown");
    const deployUrl = optionalEnv(
      "DEPLOY_WORKFLOW_URL",
      "https://github.com/Maless88/RB/actions/workflows/deploy.yml",
    );
    const pending = this.release.getPending();
    const hasPending = pending !== null && pending.sha !== current;

    return {
      current,
      pending,
      hasPending,
      deployUrl,
    };
  }

  @Post("internal/release-pending")
  setPending(
    @Headers("x-release-secret") secret: string | undefined,
    @Body() body: ReleasePendingBody,
  ): { ok: true } {

    const expected = optionalEnv("RELEASE_WEBHOOK_SECRET", "");

    if (expected === "" || secret !== expected) {
      throw new ForbiddenException("invalid release secret");
    }

    if (!body?.sha || typeof body.sha !== "string") {
      throw new ForbiddenException("sha required");
    }

    this.release.setPending(body.sha);

    return { ok: true };
  }

  @Post("deploy")
  async triggerDeploy(): Promise<TriggerDeployResponse> {

    const token = optionalEnv("GITHUB_DISPATCH_TOKEN", "");
    const repo = optionalEnv("GITHUB_REPO", "Maless88/RB");
    const workflow = optionalEnv("GITHUB_DEPLOY_WORKFLOW", "deploy.yml");
    const ref = optionalEnv("GITHUB_DEPLOY_REF", "main");

    if (token === "") {
      throw new HttpException(
        "GITHUB_DISPATCH_TOKEN not configured on server",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "roadboard-core-api",
      },
      body: JSON.stringify({ ref }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new HttpException(
        `GitHub dispatch failed: ${res.status} ${detail}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { ok: true, ref };
  }
}
