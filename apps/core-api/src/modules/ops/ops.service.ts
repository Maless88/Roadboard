import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

export interface ComponentStatus {
  name: string;
  status: "ok" | "down";
  latencyMs: number | null;
  detail?: string;
}

/**
 * Sibling-service health targets, configured via env to avoid hardcoding
 * internal ports/hostnames (which differ between local, compose and VPS).
 * Format: OPS_HEALTH_TARGETS="auth-access=http://auth-access:4002/health,mcp-service=http://mcp-service:4005/health"
 */
function parseTargets(): { name: string; url: string }[] {
  const raw = process.env.OPS_HEALTH_TARGETS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      return { name: pair.slice(0, idx).trim(), url: pair.slice(idx + 1).trim() };
    })
    .filter((t) => t.name.length > 0 && t.url.length > 0);
}

@Injectable()
export class OpsService {
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async status() {
    const [database, services] = await Promise.all([
      this.checkDatabase(),
      this.checkServices(),
    ]);
    const healthy =
      database.status === "ok" && services.every((s) => s.status === "ok");
    return {
      generatedAt: new Date().toISOString(),
      overall: healthy ? ("ok" as const) : ("degraded" as const),
      api: { name: "core-api", status: "ok" as const },
      database,
      services,
    };
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: "postgres", status: "ok", latencyMs: Date.now() - started };
    } catch (err) {
      return {
        name: "postgres",
        status: "down",
        latencyMs: null,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async checkServices(): Promise<ComponentStatus[]> {
    const targets = parseTargets();
    return Promise.all(
      targets.map(async (t): Promise<ComponentStatus> => {
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(t.url, { signal: controller.signal });
          return {
            name: t.name,
            status: res.ok ? "ok" : "down",
            latencyMs: Date.now() - started,
          };
        } catch (err) {
          return {
            name: t.name,
            status: "down",
            latencyMs: null,
            detail: err instanceof Error ? err.message : String(err),
          };
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  }
}
