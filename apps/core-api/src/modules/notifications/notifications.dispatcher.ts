import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { optionalEnv } from "@roadboard/config";
import { AgentNotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

/** Every minute: deliver pending agent notifications to the Telegram bridge /send. */
@Injectable()
export class NotificationsDispatcher {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  constructor(
    @Inject(AgentNotificationsService) private readonly svc: AgentNotificationsService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const pending = await this.svc.listPending();
    if (!pending.length) return;
    const url = optionalEnv("NOTIFY_URL", "http://host.docker.internal:8788/send");
    const token = optionalEnv("NOTIFY_TOKEN", "");
    const sent: string[] = [], failed: string[] = [];
    for (const n of pending) {
      // The Telegram bridge /send runs this through mdToHtml, so use Markdown (not raw HTML).
      const title = (n.title || "").trim();
      const body = (n.body || "").trim();
      let text: string;
      if (n.agent_slug === "reminder") {
        text = `⏰ **Promemoria**\n${title}`;
        if (body && body !== title) text += `\n${body}`;
      } else {
        const tag = n.level === "alert" ? "🚨" : n.level === "warn" ? "⚠️" : "🔔";
        const lines = [`${tag} **${title}**`];
        if (body && body !== title) lines.push(body);
        if (n.agent_slug) lines.push(`*— ${n.agent_slug}*`);
        text = lines.join("\n");
      }
      // best-effort native push (FCM/APNs); independent of Telegram delivery marking
      this.push.sendToUser(n.user_id, (n.title || "").trim(), (n.body || "").trim()).catch(() => {});
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
