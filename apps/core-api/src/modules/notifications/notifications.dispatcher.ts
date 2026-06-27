import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { optionalEnv } from "@roadboard/config";
import { AgentNotificationsService } from "./notifications.service";

/** Every minute: deliver pending agent notifications to the Telegram bridge /send. */
@Injectable()
export class NotificationsDispatcher {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  constructor(@Inject(AgentNotificationsService) private readonly svc: AgentNotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const pending = await this.svc.listPending();
    if (!pending.length) return;
    const url = optionalEnv("NOTIFY_URL", "http://host.docker.internal:8788/send");
    const token = optionalEnv("NOTIFY_TOKEN", "");
    const sent: string[] = [], failed: string[] = [];
    for (const n of pending) {
      const tag = n.level === "alert" ? "🚨" : n.level === "warn" ? "⚠️" : "🔔";
      const who = n.agent_slug ? ` [${n.agent_slug}]` : "";
      const text = `${tag}${who} ${n.title}${n.body ? `\n${n.body}` : ""}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ text }),
        });
        (r.ok ? sent : failed).push(n.id);
      } catch {
        failed.push(n.id);
      }
    }
    await this.svc.mark(sent, "sent");
    await this.svc.mark(failed, "failed");
    if (sent.length || failed.length) this.logger.log(`[notify] delivered ${sent.length}, failed ${failed.length}`);
  }
}
