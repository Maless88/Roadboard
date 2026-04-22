import { Body, Controller, ForbiddenException, Get, Headers, Post } from "@nestjs/common";
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
}
