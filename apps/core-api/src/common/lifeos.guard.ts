import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";

/**
 * Life-OS rollout gate (server-side).
 *
 * Runs AFTER AuthGuard (which populates request.user). Restricts life-OS
 * surfaces to allowlisted human users; the MCP-token channel is exempt
 * because it is already scoped per-token and is how agents reach the API.
 *
 * Allowlist: env LIFEOS_ALLOWED_USERNAMES (csv, default "alessio,admin")
 * plus any user with global role "admin". Keep in sync with the web-app
 * lib/access.ts isLifeOsUser helper.
 */
@Injectable()
export class LifeOsGuard implements CanActivate {

  private readonly allowed: string[];

  constructor() {

    this.allowed = (optionalEnv("LIFEOS_ALLOWED_USERNAMES", "alessio,admin") || "alessio,admin")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { username?: string; role?: string; source?: string }
      | undefined;

    if (!user) {
      throw new ForbiddenException("Life-OS surface: not authorized");
    }

    // MCP-token calls are the agents' own channel (scoped per token) -> allow.
    if (user.source === "mcp") {
      return true;
    }

    if ((user.role || "").toLowerCase() === "admin") {
      return true;
    }

    if (this.allowed.includes((user.username || "").toLowerCase())) {
      return true;
    }

    throw new ForbiddenException("Life-OS surface: not authorized");
  }
}
