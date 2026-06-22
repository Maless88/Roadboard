import { Controller, Get, Inject, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { optionalEnv } from "@roadboard/config";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AuditService } from "../audit/audit.service";
import type { ChatMessage } from "../chatbot/providers";
import { AgentExecutorService, type AgentExecConfig } from "./agent-executor.service";

const DEFAULT_AGENT: AgentExecConfig = {
  runtime: "cli",
  provider: "claude-code",
  model: "sonnet",
  systemPrompt:
    "Sei l'assistente del life-OS RoadBoard. Rispondi in modo conciso, pratico e in italiano.",
};
const AGENT_SLUG = "default";

@UseGuards(AuthGuard)
@Controller("agents")
export class AgentsController {

  constructor(
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Sse("chat")
  chat(
    @Query("message") message: string,
    @CurrentUser() user: AuthUser,
  ): Observable<{ data: string }> {

    if (optionalEnv("AGENTS_ENABLED", "false") !== "true") {
      return new Observable<{ data: string }>((subscriber) => {
        subscriber.next({ data: "[ERROR] agents disabled on this instance" });
        subscriber.complete();
      });
    }

    const executor = this.executor;
    const audit = this.audit;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;
      const started = Date.now();
      let chars = 0;

      void (async () => {

        void audit.recordForUser(user, "agent.run.started", "agent", AGENT_SLUG, undefined, {
          provider: DEFAULT_AGENT.provider,
          model: DEFAULT_AGENT.model,
          runtime: DEFAULT_AGENT.runtime,
        });

        try {
          const messages: ChatMessage[] = [{ role: "user", content: message ?? "" }];
          for await (const chunk of executor.stream(DEFAULT_AGENT, messages)) {
            if (cancelled) return;
            chars += chunk.length;
            subscriber.next({ data: chunk });
          }
          void audit.recordForUser(user, "agent.run.completed", "agent", AGENT_SLUG, undefined, {
            ok: true,
            durationMs: Date.now() - started,
            chars,
          });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
          void audit.recordForUser(user, "agent.run.failed", "agent", AGENT_SLUG, undefined, {
            error: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - started,
          });
          subscriber.next({
            data: `[ERROR] ${err instanceof Error ? err.message : String(err)}`,
          });
          subscriber.complete();
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  @Get("activity")
  activity(@Query("limit") limit?: string): Promise<unknown> {
    return this.audit.findRecentAgentEvents(limit ?? 50);
  }
}
