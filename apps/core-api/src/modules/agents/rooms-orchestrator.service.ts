import { Inject, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../../common/auth-user";
import type { ChatMessage } from "../chatbot/providers/types";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";
import { CoordinatorService } from "./coordinator.service";
import { RoomsService } from "./rooms.service";
import { ImageGenService } from "./image-gen.service";

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
    @Inject(ImageGenService) private readonly imageGen: ImageGenService,
  ) {}

  runTurn(user: AuthUser, roomId: string, message: string): Observable<{ data: string }> {
    const { rooms, agents, coordinator, executor, audit, imageGen } = this;

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
          const allAgents: RoomAgent[] = room.participants
            .filter((p) => p.kind === "agent")
            .map((p) => ({ slug: p.refId, capability: capBySlug.get(p.refId) ?? "" }));
          // exclude the router as a worker, unless it is the only member (direct chat with it)
          let candidates = allAgents.filter((a) => a.capability !== ROUTER_CAPABILITY);
          if (candidates.length === 0) candidates = allAgents;

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

          // Image agents (capability "image", e.g. Grafico) skip the CLI: generate
          // a PNG via the user's provider key and embed it in the message
          // (caption + "\x1f" + data-URL), so it renders as a chat bubble image.
          if ((capBySlug.get(decision.slug) ?? "") === "image") {
            const gen = await imageGen.generate(user.userId, message);
            let content: string;
            if (gen.ok) {
              subscriber.next({ data: "\ud83c\udfa8 Ecco l'immagine." });
              content = "\ud83c\udfa8 Ecco l'immagine.\x1fdata:image/png;base64," + gen.b64;
            } else if (gen.error === "no-credentials") {
              content = "Per generare immagini configura la tua API key Cloudflare nella mia scheda (Agenti \u2192 Grafico \u2192 Supporto).";
              subscriber.next({ data: content });
            } else {
              content = "Generazione immagine fallita (" + gen.error + "). Riprova o controlla la key nella scheda.";
              subscriber.next({ data: content });
            }
            await rooms.appendMessage(roomId, "agent", decision.slug, content);
            void audit.recordForUser(user, "agent.run.completed", "agent", decision.slug, undefined, {
              ok: gen.ok, durationMs: Date.now() - started, image: gen.ok, roomId,
            });
            subscriber.next({ data: "[DONE]" });
            subscriber.complete();
            return;
          }

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
            reply += chunk;
            // Finish generating and persist even if the client disconnected
            // (navigated away / pressed Back): the reply must be saved so it is
            // there when the user returns. Just stop pushing to a dead stream.
            if (!cancelled) subscriber.next({ data: chunk });
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

  /**
   * Share the source room's conversation into the target agent's direct room as
   * a context message (auto-summarized; falls back to a transcript excerpt).
   */
  async shareRoom(ownerUserId: string, sourceRoomId: string, toAgentSlug: string): Promise<{ targetRoomId: string }> {
    const source = (await this.rooms.getRoom(ownerUserId, sourceRoomId)) as {
      participants: { kind: string; refId: string }[];
      messages: { senderKind: string; senderId: string; content: string }[];
    };
    const transcript = source.messages
      .map((m) => `${m.senderKind === "user" ? "Utente" : m.senderId}: ${m.content}`)
      .join("\n");
    const fromAgents = source.participants.filter((p) => p.kind === "agent").map((p) => p.refId).join(", ") || "chat";

    let summary = "";
    try {
      const { config } = await this.agents.resolveForChat("assistant", ownerUserId);
      const sumCfg = { ...config, systemPrompt: "Riassumi la conversazione per passarla a un altro agente come contesto. Solo il riassunto, conciso, in italiano." };
      const messages: ChatMessage[] = [{ role: "user", content: `Conversazione:\n${transcript}` }];
      for await (const ch of this.executor.stream(sumCfg, messages)) summary += ch;
    } catch { summary = ""; }

    const body = summary.trim() || transcript.slice(0, 2000);
    const target = (await this.rooms.ensureDirectRoom(ownerUserId, toAgentSlug)) as { id: string };
    await this.rooms.appendMessage(target.id, "user", ownerUserId, `📎 Contesto dalla chat con ${fromAgents}:\n${body}`);
    return { targetRoomId: target.id };
  }
}
