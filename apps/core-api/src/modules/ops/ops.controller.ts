import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { OpsService } from "./ops.service";

@UseGuards(AuthGuard)
@Controller("ops")
export class OpsController {
  constructor(@Inject(OpsService) private readonly opsService: OpsService) {}

  @Get("status")
  status() {
    return this.opsService.status();
  }
}
