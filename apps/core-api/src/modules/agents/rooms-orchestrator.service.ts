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
/** Strip the embedded image data-URL (caption + "\x1f" + dataURL) so generated
 * images are never fed back into the LLM prompt on subsequent turns. */
export function forLlmContent(content: string): string {
  const i = content.indexOf("\x1f");
  return i === -1 ? content : content.slice(0, i);
}

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
            projectId?: string | null;
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

          // Image agent (capability "image", e.g. Grafico): it converses like a normal
          // LLM agent. Only when it decides to generate does it emit a directive
          // "[[IMG]] <english prompt>" on its own line; we intercept that, call FLUX,
          // and embed the PNG (caption + "\x1f" + data-URL). The directive is never
          // streamed to the user.
          if ((capBySlug.get(decision.slug) ?? "") === "image") {
            const { slug: gslug, config: gconfig } = await agents.resolveForChat(decision.slug, user.userId);
            gconfig.projectId = room.projectId ?? null; gconfig.source = "chat";
            const gmsgs: ChatMessage[] = room.messages.map((mm) => {
              if (mm.senderKind === "user") return { role: "user", content: forLlmContent(mm.content) };
              if (mm.senderId === gslug) return { role: "assistant", content: forLlmContent(mm.content) };
              return { role: "user", content: `[${mm.senderId}]: ${forLlmContent(mm.content)}` };
            });
            let reply = "";
            let shown = 0;
            for await (const chunk of executor.stream(gconfig, gmsgs)) {
              reply += chunk;
              const cut = reply.indexOf("[[");
              const safeEnd = cut === -1 ? reply.length : cut;
              if (safeEnd > shown && !cancelled) { subscriber.next({ data: reply.slice(shown, safeEnd) }); shown = safeEnd; }
            }
            const m = reply.match(/\[\[IMG\]\]\s*([\s\S]+?)\s*$/i);
            let content: string;
            if (m && typeof m.index === "number") {
              const prompt = m[1].trim();
              const visible = reply.slice(0, m.index).trim() || "🎨 Ecco l'immagine.";
              if (!cancelled) subscriber.next({ data: "\n🎨 genero l'immagine…" });
              const gen = await imageGen.generate(user.userId, prompt);
              if (gen.ok) content = visible + "\x1fdata:image/png;base64," + gen.b64;
              else if (gen.error === "no-credentials") content = visible + "\n(Per generare configura la API key Cloudflare nella mia scheda → Supporto.)";
              else content = visible + "\n(Generazione fallita: " + gen.error + ".)";
              void audit.recordForUser(user, "agent.run.completed", "agent", gslug, undefined, { ok: gen.ok, durationMs: Date.now() - started, image: gen.ok, roomId });
            } else {
              content = reply.trim();
              void audit.recordForUser(user, "agent.run.completed", "agent", gslug, undefined, { ok: true, durationMs: Date.now() - started, image: false, roomId });
            }
            if (content.length > 0) await rooms.appendMessage(roomId, "agent", gslug, content);
            subscriber.next({ data: "[DONE]" });
            subscriber.complete();
            return;
          }

          const { slug, config } = await agents.resolveForChat(decision.slug, user.userId);
          config.projectId = room.projectId ?? null; config.source = "chat";
          const messages: ChatMessage[] = room.messages.map((m) => {
            if (m.senderKind === "user") return { role: "user", content: forLlmContent(m.content) };
            if (m.senderId === slug) return { role: "assistant", content: forLlmContent(m.content) };
            return { role: "user", content: `[${m.senderId}]: ${forLlmContent(m.content)}` };
          });

          void audit.recordForUser(user, "agent.run.started", "agent", slug, undefined, {
            provider: config.provider, model: config.model, runtime: config.runtime, roomId,
          });

          // Stream the agent's reply, holding back any "[[" directive (delegation).
          let reply = "";
          let shown = 0;
          for await (const chunk of executor.stream(config, messages)) {
            reply += chunk;
            const cut = reply.indexOf("[[");
            const safeEnd = cut === -1 ? reply.length : cut;
            if (safeEnd > shown && !cancelled) { subscriber.next({ data: reply.slice(shown, safeEnd) }); shown = safeEnd; }
          }

          // Agent-to-agent delegation: "[[ASK:<slug>]] <question>" lets the chat agent
          // consult another agent; the called agent's reply shows in THIS chat
          // (attributed to it), then the chat agent synthesizes. Depth 1 (no chains).
          const ask = reply.match(/\[\[ASK:\s*([a-zA-Z0-9_-]+)\s*\]\]\s*([\s\S]+?)\s*$/);
          const target = ask ? ask[1].toLowerCase() : null;
          const lead = ask && typeof ask.index === "number" ? reply.slice(0, ask.index).trim() : reply.trim();

          if (ask && target && target !== slug && capBySlug.has(target)) {
            const question = ask[2].trim();
            const tName = (agentList.find((a) => a.slug === target) as unknown as { name?: string } | undefined)?.name ?? target;
            if (lead) await rooms.appendMessage(roomId, "agent", slug, lead);
            const askLine = `↪ Chiedo a ${tName}: ${question}`;
            if (!cancelled) subscriber.next({ data: `\n${askLine}` });
            await rooms.appendMessage(roomId, "agent", slug, askLine);

            const { slug: tSlug, config: tConfig } = await agents.resolveForChat(target, user.userId);
            tConfig.projectId = room.projectId ?? null; tConfig.source = "chat";
            let tReply = "";
            for await (const chunk of executor.stream(tConfig, [{ role: "user", content: question }])) {
              tReply += chunk;
            }
            tReply = tReply.split("[[")[0].trim() || "(nessuna risposta)";
            await rooms.appendMessage(roomId, "agent", tSlug, tReply);
            void audit.recordForUser(user, "agent.run.completed", "agent", tSlug, undefined, { ok: true, durationMs: Date.now() - started, delegatedFrom: slug, roomId });

            const synthMsgs: ChatMessage[] = [
              ...messages,
              { role: "user", content: `[sistema] Hai consultato ${tName}, che ha risposto:\n${tReply}\nUsa questa risposta per rispondere all'utente in modo conciso. Non emettere altre direttive.` },
            ];
            let synth = "";
            for await (const chunk of executor.stream(config, synthMsgs)) {
              synth += chunk;
              if (!cancelled) subscriber.next({ data: chunk });
            }
            synth = synth.split("[[")[0].trim();
            if (synth) await rooms.appendMessage(roomId, "agent", slug, synth);
          } else if (ask && target) {
            const note = (lead ? lead + "\n" : "") + `(non trovo l'agente "${target}")`;
            await rooms.appendMessage(roomId, "agent", slug, note);
          } else {
            if (reply.trim().length > 0) await rooms.appendMessage(roomId, "agent", slug, reply.trim());
          }

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
