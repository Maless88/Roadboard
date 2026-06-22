import { Controller, Inject, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { AuthGuard } from "../../common/auth.guard";
import type { ChatMessage } from "../chatbot/providers";
import { AgentExecutorService, type AgentExecConfig } from "./agent-executor.service";

/**
 * MVP chat: ephemeral conversation, single default agent, real SSE streaming
 * via the executor. History persistence + Coordinator routing are follow-ups.
 * Message passed as query param for MVP; the frontend will switch to a richer
 * transport (fetch-stream with body) later.
 */
const DEFAULT_AGENT: AgentExecConfig = {
  runtime: "cli",
  provider: "claude-code",
  model: "sonnet",
  systemPrompt:
    "Sei l'assistente del life-OS RoadBoard. Rispondi in modo conciso, pratico e in italiano.",
};

@UseGuards(AuthGuard)
@Controller("agents")
export class AgentsController {

  constructor(
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
  ) {}

  @Sse("chat")
  chat(@Query("message") message: string): Observable<{ data: string }> {

    const executor = this.executor;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;

      void (async () => {
        try {
          const messages: ChatMessage[] = [{ role: "user", content: message ?? "" }];
          for await (const chunk of executor.stream(DEFAULT_AGENT, messages)) {
            if (cancelled) return;
            subscriber.next({ data: chunk });
          }
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
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
