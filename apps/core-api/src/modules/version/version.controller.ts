import { Controller, Get } from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";


interface VersionResponse {
  sha: string;
  builtAt: string;
  service: string;
}


@Controller("version")
export class VersionController {

  @Get()
  get(): VersionResponse {

    return {
      sha: optionalEnv("BUILD_SHA", "unknown"),
      builtAt: optionalEnv("BUILD_TIME", "unknown"),
      service: "core-api",
    };
  }
}
