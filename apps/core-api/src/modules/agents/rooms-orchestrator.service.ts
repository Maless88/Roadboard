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
import { AgentMemoryService } from "./agent-memory.service";

export interface RoomAgent { slug: string; capability: string }

const ROUTER_CAPABILITY = "routing";

// Rooms with a turn in flight — guards against overlapping turns on the same room.
const busyRooms = new Set<string>();

const MARKER_RE = /^\s*(↪ Chiedo a |_→ .*_\s*$)/;
const META_RE = /\b(let me\b|i should\b|i'?ll\b|i will\b|i need to\b|the user\b|i don'?t\b|i can'?t\b|we already\b|note (that|the)\b|as vera\b|let'?s\b|i'?m going to\b|first,? |continue the loop\b|looking at the (conversation|transcript)\b|the deferred tools\b)/i;

/** Strip the agent's "thinking out loud" + streamed markers (↪ / _→ tool_ / [[..]] / <br>)
 *  before persisting a message or feeding it back into the model's context. */
export function stripAgentMeta(s: string): string {
  let t = (s || "")
    .replace(/\[\[ASK:[a-z0-9_-]+\]\]/gi, "")
    .replace(/\[\[IMG\]\]/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  t = t.split("\n").filter((l) => !MARKER_RE.test(l)).join("\n");
  const paras = t.split(/\n\s*\n/);
  let i = 0;
  while (i < paras.length - 1 && META_RE.test(paras[i])) i++;
  let out = paras.slice(i).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  // Also drop leading meta SENTENCES (handles inline/glued meta, es. "Let me recall.Dalla…").
  const sent = out.split(/(?<=[.?!])\s+|(?<=[.?!])(?=[A-ZÀ-Ÿ])/);
  let j = 0;
  while (j < sent.length - 1 && META_RE.test(sent[j]) && sent[j].length < 240) j++;
  if (j > 0) out = sent.slice(j).join(" ").trim();
  return out;
}

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
    @Inject(AgentMemoryService) private readonly memory: AgentMemoryService,
  ) {}

  runTurn(user: AuthUser, roomId: string, message: string): Observable<{ data: string }> {
    const { rooms, agents, coordinator, executor, audit, imageGen, memory } = this;

    return new Observable<{ data: string }>((subscriber) => {

      let cancelled = false;
      const started = Date.now();

      void (async () => {
        // Per-room lock: reject a second turn while one is already running.
        if (busyRooms.has(roomId)) {
          subscriber.next({ data: `\x1e${JSON.stringify({ senderKind: "agent", senderId: "assistant" })}\n` });
          subscriber.next({ data: "Sto già elaborando una richiesta in questa stanza — attendi che finisca." });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
          return;
        }
        busyRooms.add(roomId);
        try {
          await rooms.postMessage(user.userId, roomId, message); // membership-gated
          const room = (await rooms.getRoom(user.userId, roomId)) as {
            projectId?: string | null;
            participants: { kind: string; refId: string }[];
            messages: { senderKind: string; senderId: string; content: string }[];
          };
          const repoUrl = room.projectId ? await rooms.getProjectRepoUrl(room.projectId) : null;

          // Durable memory — CAPTURE: explicit "ricordati/ricorda/impara/segnati … (che) X".
          // Server-side so it works even for agents without MCP (e.g. Vera). Best-effort.
          const memMatch = message.match(/\b(?:ricordati|ricorda|impara|segnati|tieni a mente|memorizza)\b(?:\s+che)?\s*[:,]?\s*([\s\S]{3,})/i);
          if (memMatch) {
            void memory.remember(user.userId, memMatch[1].trim(), { projectId: room.projectId ?? null, source: "user", importance: 4 })
              .catch(() => { /* best-effort */ });
          } else if (message.trim().length >= 30) {
            // PHASE 2 — auto-estrazione dei fatti impliciti (LLM locale, fire-and-forget, non blocca il turno)
            void memory.extractAndStore(user.userId, message, { projectId: room.projectId ?? null })
              .catch(() => { /* best-effort */ });
          }

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
            gconfig.projectId = room.projectId ?? null; gconfig.source = "chat"; gconfig.repoUrl = repoUrl;
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
          config.projectId = room.projectId ?? null; config.source = "chat"; config.repoUrl = repoUrl;
          // Inject the LIVE team roster so the delegating agent knows every slug it can
          // [[ASK]] (avoids relying on a stale hardcoded list in the system prompt).
          const roster = (agentList as { slug: string; capability: string; name?: string }[])
            .filter((a) => a.slug !== slug)
            .map((a) => `- ${a.slug} (${a.name ?? a.slug}) — ${a.capability || "text"}`)
            .join("\n");
          if (roster) {
            config.systemPrompt = `${config.systemPrompt || ""}\n\n## Team del momento (usa SOLO questi slug per [[ASK:<slug>]])\n${roster}\nSe l'utente chiede "tutti gli agenti", consultali TUTTI uno per volta (verrai richiamato in automatico).`;
          }

          // Durable memory — RECALL: inject the most relevant memories for (user, project)
          // into the responder's context (works for every agent, incl. Vera). Best-effort.
          try {
            const mems = await memory.recall(user.userId, message, { projectId: room.projectId ?? null, limit: 6 });
            if (mems.length) {
              config.systemPrompt = `${config.systemPrompt || ""}\n\n## Memoria (cose apprese su Alessio / contesto persistente — usale se pertinenti)\n${mems.map((m) => `- ${m.content}`).join("\n")}`;
            }
          } catch { /* memory is best-effort, never block a turn */ }
          // Feed prior agent turns back WITHOUT the streamed markers (↪ / _→ tool_) or
          // leaked meta, so the model doesn't parrot that syntax in new turns.
          const messages: ChatMessage[] = [];
          for (const m of room.messages) {
            if (m.senderKind === "user") { messages.push({ role: "user", content: forLlmContent(m.content) }); continue; }
            const cleaned = stripAgentMeta(forLlmContent(m.content));
            if (!cleaned) continue;
            messages.push(m.senderId === slug
              ? { role: "assistant", content: cleaned }
              : { role: "user", content: `[${m.senderId}]: ${cleaned}` });
          }

          void audit.recordForUser(user, "agent.run.started", "agent", slug, undefined, {
            provider: config.provider, model: config.model, runtime: config.runtime, roomId,
          });

          // Agentic delegation LOOP: the responder may consult other agents with one
          // "[[ASK:<slug>]] <question>" per step; after each consultation we feed the reply
          // back and re-invoke it, until it answers with no directive (or hits the cap).
          // This lets a single user message drive a full multi-agent task without the
          // user having to re-prompt between consultations. Depth 1 (delegates don't chain).
          const ASK_RE = /\[\[ASK:\s*([a-zA-Z0-9_-]+)\s*\]\]\s*([\s\S]+?)\s*$/;
          const MAX_STEPS = 12;                // cap: bounds Opus calls per user turn
          const convo: ChatMessage[] = [...messages];
          let totalChars = 0, steps = 0;
          for (let iter = 0; !cancelled; iter++) {
            const forceFinal = iter >= MAX_STEPS;   // last pass: no more delegation, must answer
            let reply = "";
            let shown = 0;
            for await (const chunk of executor.stream(config, convo)) {
              if (cancelled) break;
              reply += chunk;
              const cut = reply.indexOf("[[");
              const safeEnd = cut === -1 ? reply.length : cut;
              if (safeEnd > shown && !cancelled) { subscriber.next({ data: reply.slice(shown, safeEnd) }); shown = safeEnd; }
            }
            totalChars += reply.length;
            const ask = forceFinal ? null : reply.match(ASK_RE);
            const target = ask ? ask[1].toLowerCase() : null;
            const rawLead = ask && typeof ask.index === "number" ? reply.slice(0, ask.index) : reply;
            const lead = stripAgentMeta(rawLead);   // drop the agent's thinking-out-loud + markers

            // No (more) delegation -> this is the final answer.
            if (!ask || !target) {
              if (lead) await rooms.appendMessage(roomId, "agent", slug, lead);
              break;
            }
            // Unknown / self target -> inform and let it recover on the next pass.
            if (target === slug || !capBySlug.has(target)) {
              if (lead) await rooms.appendMessage(roomId, "agent", slug, lead);
              convo.push({ role: "assistant", content: (lead ? lead + "\n" : "") + `[[ASK:${target}]] ...` });
              convo.push({ role: "user", content: `[sistema] Agente "${target}" non disponibile. Prosegui senza consultarlo; se non ti servono altri agenti dai la risposta finale.` });
              continue;
            }
            // Consult the target agent, persist its reply, feed it back, loop.
            steps++;
            // Question = only the first paragraph after [[ASK]] (avoid capturing trailing reasoning).
            const question = ask[2].split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim().slice(0, 600) || "(domanda)";
            const tName = (agentList.find((a) => a.slug === target) as unknown as { name?: string } | undefined)?.name ?? target;
            if (lead) await rooms.appendMessage(roomId, "agent", slug, lead);
            const askLine = `↪ Chiedo a ${tName}: ${question}`;
            if (!cancelled) subscriber.next({ data: `\n${askLine}\n` });
            await rooms.appendMessage(roomId, "agent", slug, askLine);

            const { slug: tSlug, config: tConfig } = await agents.resolveForChat(target, user.userId);
            tConfig.projectId = room.projectId ?? null; tConfig.source = "chat"; tConfig.repoUrl = repoUrl;
            let tReply = "";
            for await (const chunk of executor.stream(tConfig, [{ role: "user", content: question }])) { if (cancelled) break; tReply += chunk; }
            tReply = stripAgentMeta(tReply.split("[[")[0]) || "(nessuna risposta)";
            await rooms.appendMessage(roomId, "agent", tSlug, tReply);
            void audit.recordForUser(user, "agent.run.completed", "agent", tSlug, undefined, { ok: true, durationMs: Date.now() - started, delegatedFrom: slug, roomId });

            const nearCap = iter + 1 >= MAX_STEPS;
            // Feed back a CLEAN turn (no markers/reasoning) so the model doesn't parrot syntax.
            convo.push({ role: "assistant", content: (lead ? lead + "\n" : "") + `[[ASK:${target}]] ${question}` });
            convo.push({ role: "user", content: `[sistema] ${tName} ha risposto:\n${tReply}\n\nProsegui la richiesta dell'utente. ${nearCap ? "Dai ORA la risposta finale, senza altre consultazioni." : "Se ti serve un altro agente emetti una nuova [[ASK:<slug>]] (una sola); altrimenti dai la risposta finale, concisa. NON scrivere ragionamento o righe tipo '_→' o '↪'."}` });
          }

          void audit.recordForUser(user, "agent.run.completed", "agent", slug, undefined, {
            ok: true, durationMs: Date.now() - started, chars: totalChars, roomId,
          });
          subscriber.next({ data: "[DONE]" });
          subscriber.complete();
        } catch (err) {
          subscriber.next({ data: `[ERROR] ${err instanceof Error ? err.message : String(err)}` });
          subscriber.complete();
        } finally {
          busyRooms.delete(roomId);
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
