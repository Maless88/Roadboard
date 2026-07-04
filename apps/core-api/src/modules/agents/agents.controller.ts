import { Controller, Get, Inject, Param, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { optionalEnv } from "@roadboard/config";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AuditService } from "../audit/audit.service";
import type { ChatMessage } from "../chatbot/providers";
import { AgentExecutorService } from "./agent-executor.service";
import type { AgentRunSidecar } from "@roadboard/agent-runtime";
import { AgentsService } from "./agents.service";
import { ChatService } from "./chat.service";
import { CoordinatorService } from "./coordinator.service";

@UseGuards(AuthGuard)
@Controller("agents")
export class AgentsController {

  constructor(
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(CoordinatorService) private readonly coordinator: CoordinatorService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  list(): Promise<unknown> {
    return this.agents.list();
  }

  @Get("contacts")
  contacts(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.chat.contacts(user.userId);
  }

  @Get("activity")
  activity(@Query("limit") limit?: string): Promise<unknown> {
    return this.audit.findRecentAgentEvents(limit ?? 50);
  }

  @Get("profile/:slug")
  profile(@Param("slug") slug: string): Promise<unknown> {
    return this.agents.profile(slug);
  }

  @Get("threads/:slug/messages")
  messages(@Param("slug") slug: string, @CurrentUser() user: AuthUser): Promise<unknown> {
    return this.chat.listMessages(user.userId, slug);
  }

  @Sse("chat")
  chatStream(
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
    const chat = this.chat;
    const coordinator = this.coordinator;
    const audit = this.audit;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;
      const started = Date.now();
      let reply = "";

      void (async () => {

        const { slug, config } = await agents.resolveForChat(agentSlug, user.userId);
        const thread = await chat.getOrCreateThread(user.userId, slug);
        await chat.appendMessage(thread.id, "user", message ?? "");

        let runSlug = slug;
        let runConfig = config;
        if (slug === "coordinator") {
          const r = await coordinator.route(message ?? "");
          const resolved = await agents.resolveForChat(r.slug, user.userId);
          runSlug = resolved.slug;
          runConfig = resolved.config;
          // Structured handoff marker (RS-prefixed JSON line): the boardchat
          // client parses it into a handoff chip; invisible if left unparsed.
          const note = `\x1e${JSON.stringify({ from: "coordinator", to: runSlug, reason: r.reason })}\n`;
          reply += note;
          subscriber.next({ data: note });
          void audit.recordForUser(user, "agent.run.routed", "agent", slug, undefined, { to: runSlug, reason: r.reason });
        }

        void audit.recordForUser(user, "agent.run.started", "agent", runSlug, undefined, {
          provider: runConfig.provider,
          model: runConfig.model,
          runtime: runConfig.runtime,
        });

        try {
          const messages: ChatMessage[] = [{ role: "user", content: message ?? "" }];
          const sidecar: AgentRunSidecar = {};
          for await (const chunk of executor.stream(runConfig, messages, sidecar)) {
            if (cancelled) return;
            reply += chunk;
            subscriber.next({ data: chunk });
          }
          if (reply.length > 0) await chat.appendMessage(thread.id, "assistant", reply);
          const u = sidecar.usage;
          void audit.recordForUser(user, "agent.run.completed", "agent", runSlug, undefined, {
            ok: true,
            durationMs: Date.now() - started,
            chars: reply.length,
            ...(u ? { tokensIn: u.in, tokensOut: u.out, tokensCacheCreate: u.cc, tokensCacheRead: u.cr, tokensTotal: u.in + u.out + u.cc + u.cr } : {}),
          });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
          void audit.recordForUser(user, "agent.run.failed", "agent", runSlug, undefined, {
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
