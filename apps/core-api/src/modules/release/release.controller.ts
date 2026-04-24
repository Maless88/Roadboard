import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";

import { ReleaseService } from "./release.service";


interface ReleaseStatusResponse {
  currentSha: string;
  latestMainSha: string | null;
  latestMainAt: string | null;
  hasPending: boolean;
  deploying: boolean;
  lastDeployError: string | null;
}


interface TriggerDeployResponse {
  ok: true;
}


@Controller()
export class ReleaseController {

  constructor(private readonly release: ReleaseService) {}

  @Get("release-status")
  async getStatus(): Promise<ReleaseStatusResponse> {
    return this.release.getStatus();
  }

  @Post("deploy")
  async triggerDeploy(): Promise<TriggerDeployResponse> {

    const result = await this.release.startDeploy();

    if (!result.accepted) {
      throw new HttpException(
        result.reason ?? "deploy not accepted",
        HttpStatus.CONFLICT,
      );
    }

    return { ok: true };
  }


  @Post("internal/release-pending")
  releasePending(
    @Headers("x-release-secret") providedSecret: string | undefined,
    @Body() _body: { sha?: string },
  ): { ok: true } {

    const expected = optionalEnv("RELEASE_WEBHOOK_SECRET", "");

    if (expected === "" || providedSecret !== expected) {
      throw new ForbiddenException("invalid release secret");
    }

    this.release.invalidateLatestMainCache();
    return { ok: true };
  }
}
