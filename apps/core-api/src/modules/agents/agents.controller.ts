import { Controller, Get, Inject, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { optionalEnv } from "@roadboard/config";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AuditService } from "../audit/audit.service";
import type { ChatMessage } from "../chatbot/providers";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";

@UseGuards(AuthGuard)
@Controller("agents")
export class AgentsController {

  constructor(
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  list(): Promise<unknown> {
    return this.agents.list();
  }

  @Get("activity")
  activity(@Query("limit") limit?: string): Promise<unknown> {
    return this.audit.findRecentAgentEvents(limit ?? 50);
  }

  @Sse("chat")
  chat(
    @Query("message") message: string,
    @CurrentUser() user: AuthUser,
    @Query("agent") agentSlug?: string,
  ): Observable<{ data: string }> {

    if (optionalEnv("AGENTS_ENABLED", "false") !== "true") {
      return new Observable<{ data: string }>((subscriber) => {
        subscriber.next({ data: "[ERROR] agents disabled on this instance" });
        subscriber.complete();
      });
    }

    const executor = this.executor;
    const agents = this.agents;
    const audit = this.audit;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;
      const started = Date.now();
      let chars = 0;

      void (async () => {

        const { slug, config } = await agents.resolveForChat(agentSlug);

        void audit.recordForUser(user, "agent.run.started", "agent", slug, undefined, {
          provider: config.provider,
          model: config.model,
          runtime: config.runtime,
        });

        try {
          const messages: ChatMessage[] = [{ role: "user", content: message ?? "" }];
          for await (const chunk of executor.stream(config, messages)) {
            if (cancelled) return;
            chars += chunk.length;
            subscriber.next({ data: chunk });
          }
          void audit.recordForUser(user, "agent.run.completed", "agent", slug, undefined, {
            ok: true,
            durationMs: Date.now() - started,
            chars,
          });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
          void audit.recordForUser(user, "agent.run.failed", "agent", slug, undefined, {
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
}
