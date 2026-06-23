import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../../common/auth.guard";
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


@UseGuards(AuthGuard)
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
}
