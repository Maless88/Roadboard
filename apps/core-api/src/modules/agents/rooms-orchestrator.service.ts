import { Inject, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../../common/auth-user";
import type { ChatMessage } from "../chatbot/providers/types";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";
import { CoordinatorService } from "./coordinator.service";
import { RoomsService } from "./rooms.service";

export interface RoomAgent { slug: string; capability: string }

const ROUTER_CAPABILITY = "routing";

/** Extract @mentions (slug tokens) from a message, lowercased and de-duped. */
export function parseMentions(message: string): string[] {
  const out = new Set<string>();
  const re = /@([a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message ?? "")) !== null) out.add(m[1].toLowerCase());
  return [...out];
}

/**
 * Turn-taking 2C (hybrid): an explicit @mention of a room agent wins; otherwise
 * the director picks the room agent whose capability matches the message, else
 * the first candidate. Returns null when the room has no eligible agent.
 */
export function decideResponder(
  message: string,
  candidates: RoomAgent[],
  capabilityForMessage: (m: string) => string,
): { slug: string; reason: string } | null {
  if (!candidates.length) return null;
  const mentioned = parseMentions(message).find((s) => candidates.some((a) => a.slug === s));
  if (mentioned) return { slug: mentioned, reason: "mention" };
  const cap = capabilityForMessage(message);
  const byCap = candidates.find((a) => (a.capability ?? "").toLowerCase() === cap);
  if (byCap) return { slug: byCap.slug, reason: `director:capability:${cap}` };
  return { slug: candidates[0].slug, reason: "director:fallback" };
}

/**
 * Drives one conversational turn inside a room: posts the user message, lets the
 * director pick a responder (2C), runs that agent against the room transcript,
 * streams its reply, and persists it as an agent-authored RoomMessage.
 */
@Injectable()
export class RoomOrchestratorService {

  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(CoordinatorService) private readonly coordinator: CoordinatorService,
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  runTurn(user: AuthUser, roomId: string, message: string): Observable<{ data: string }> {
    const { rooms, agents, coordinator, executor, audit } = this;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;
      const started = Date.now();

      void (async () => {
        try {
          await rooms.postMessage(user.userId, roomId, message); // membership-gated
          const room = (await rooms.getRoom(user.userId, roomId)) as {
            participants: { kind: string; refId: string }[];
            messages: { senderKind: string; senderId: string; content: string }[];
          };

          const agentList = (await agents.list()) as { slug: string; capability: string }[];
          const capBySlug = new Map(agentList.map((a) => [a.slug, (a.capability ?? "").toLowerCase()]));
          const candidates: RoomAgent[] = room.participants
            .filter((p) => p.kind === "agent")
            .map((p) => ({ slug: p.refId, capability: capBySlug.get(p.refId) ?? "" }))
            .filter((a) => a.capability !== ROUTER_CAPABILITY);

          const decision = decideResponder(message, candidates, (m) => coordinator.capabilityForMessage(m));
          if (!decision) {
            subscriber.next({ data: "[ERROR] nessun agente disponibile nella stanza" });
            subscriber.complete();
            return;
          }

          // sender header marker: lets the UI attribute the streamed bubble
          subscriber.next({
            data: `\x1e${JSON.stringify({ senderKind: "agent", senderId: decision.slug, reason: decision.reason })}\n`,
          });
          void audit.recordForUser(user, "agent.run.routed", "room", roomId, undefined, {
            to: decision.slug, reason: decision.reason,
          });

          const { slug, config } = await agents.resolveForChat(decision.slug, user.userId);
          const messages: ChatMessage[] = room.messages.map((m) => {
            if (m.senderKind === "user") return { role: "user", content: m.content };
            if (m.senderId === slug) return { role: "assistant", content: m.content };
            return { role: "user", content: `[${m.senderId}]: ${m.content}` };
          });

          void audit.recordForUser(user, "agent.run.started", "agent", slug, undefined, {
            provider: config.provider, model: config.model, runtime: config.runtime, roomId,
          });

          let reply = "";
          for await (const chunk of executor.stream(config, messages)) {
            if (cancelled) return;
            reply += chunk;
            subscriber.next({ data: chunk });
          }
          if (reply.length > 0) await rooms.appendMessage(roomId, "agent", slug, reply);
          void audit.recordForUser(user, "agent.run.completed", "agent", slug, undefined, {
            ok: true, durationMs: Date.now() - started, chars: reply.length, roomId,
          });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
          subscriber.next({ data: `[ERROR] ${err instanceof Error ? err.message : String(err)}` });
          subscriber.complete();
        }
      })();

      return () => { cancelled = true; };
    });
  }
}
