import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

const OLLAMA_EMBED_URL = process.env.OLLAMA_EMBED_URL || "http://host.docker.internal:11434/api/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
const OLLAMA_GEN_URL = process.env.OLLAMA_GEN_URL || "http://host.docker.internal:11434/api/generate";
const EXTRACT_MODEL = process.env.EXTRACT_MODEL || "llama3.2:3b";

export interface MemoryRow {
  id: string;
  content: string;
  type: string;
  importance: number;
  created_at: Date;
  sim?: number;
}

/**
 * Durable agent memory (mem0-style) on Postgres + pgvector. Scope per-user, optionally
 * per-project (project_id NULL = user-global). Embeddings via local Ollama (nomic-embed-text,
 * 768-dim). Capture & recall are driven server-side by the orchestrator, so they work for
 * every agent — including ones without MCP access (e.g. the assistant Vera).
 */
@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  /** Embed text with Ollama. Returns null on any failure (callers fall back to FTS). */
  async embed(text: string): Promise<number[] | null> {
    try {
      const r = await fetch(OLLAMA_EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 8000) }),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as { embedding?: number[] };
      return Array.isArray(d.embedding) && d.embedding.length ? d.embedding : null;
    } catch (e) {
      this.logger.warn(`[memory] embed failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  private vec(e: number[]): string {
    return "[" + e.join(",") + "]";
  }

  /** Store a memory. Near-duplicates in the same scope are UPDATED instead of inserted. */
  async remember(
    userId: string,
    content: string,
    opts: { projectId?: string | null; scope?: string; type?: string; importance?: number; source?: string } = {},
  ): Promise<{ ok: boolean; id?: string; deduped?: boolean }> {
    const text = (content || "").trim();
    if (!text || !userId) return { ok: false };
    const emb = await this.embed(text);
    const projectId = opts.projectId ?? null;
    const scope = opts.scope || (projectId ? "project" : "user");
    const type = opts.type || "semantic";
    const importance = Math.max(1, Math.min(5, opts.importance ?? 3));
    const source = opts.source || "explicit";

    if (emb) {
      const dup = await this.prisma.$queryRawUnsafe<{ id: string; dist: number }[]>(
        `SELECT id, (embedding <=> $1::vector) AS dist FROM "agent_memories"
         WHERE user_id=$2 AND project_id IS NOT DISTINCT FROM $3 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC LIMIT 1`,
        this.vec(emb), userId, projectId,
      );
      if (dup[0] && Number(dup[0].dist) < 0.08) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "agent_memories" SET content=$1, embedding=$2::vector, importance=$3, type=$4, updated_at=now() WHERE id=$5`,
          text, this.vec(emb), importance, type, dup[0].id,
        );
        return { ok: true, id: dup[0].id, deduped: true };
      }
    }
    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "agent_memories" (user_id, project_id, scope, type, content, embedding, importance, source)
       VALUES ($1,$2,$3,$4,$5,$6::vector,$7,$8) RETURNING id`,
      userId, projectId, scope, type, text, emb ? this.vec(emb) : null, importance, source,
    );
    return { ok: true, id: rows[0]?.id };
  }

  /** Recall the most relevant memories for (user, project) given a query.
   *  Vector path ranks by similarity + recency + importance; FTS fallback if embed fails. */
  async recall(userId: string, query: string, opts: { projectId?: string | null; limit?: number } = {}): Promise<MemoryRow[]> {
    if (!userId || !(query || "").trim()) return [];
    const limit = Math.max(1, Math.min(20, opts.limit ?? 6));
    const projectId = opts.projectId ?? null;
    const emb = await this.embed(query);

    if (emb) {
      const cand = await this.prisma.$queryRawUnsafe<(MemoryRow & { sim: number })[]>(
        `SELECT id, content, type, importance, created_at, 1 - (embedding <=> $1::vector) AS sim
         FROM "agent_memories"
         WHERE user_id=$2 AND (project_id IS NULL OR project_id=$3) AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC LIMIT 30`,
        this.vec(emb), userId, projectId,
      );
      const now = Date.now();
      const ranked = cand
        .map((r) => {
          const ageDays = (now - new Date(r.created_at).getTime()) / 86_400_000;
          const recency = Math.exp(-ageDays / 30);
          const score = Number(r.sim) * 0.7 + recency * 0.15 + (Number(r.importance) / 5) * 0.15;
          return { ...r, score };
        })
        .filter((r) => Number(r.sim) > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      await this.touch(ranked.map((r) => r.id));
      return ranked;
    }

    const rows = await this.prisma.$queryRawUnsafe<MemoryRow[]>(
      `SELECT id, content, type, importance, created_at FROM "agent_memories"
       WHERE user_id=$1 AND (project_id IS NULL OR project_id=$2)
         AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $3)
       ORDER BY importance DESC, created_at DESC LIMIT $4`,
      userId, projectId, query, limit,
    );
    await this.touch(rows.map((r) => r.id));
    return rows;
  }

  /** PHASE 2 — auto-extraction: pull durable user facts/preferences from a message with a
   *  small local LLM (Ollama, format=json) and store them (dedup handled by remember()).
   *  Local & free; best-effort & meant to run fire-and-forget (never blocks a turn). */
  async extractAndStore(userId: string, text: string, opts: { projectId?: string | null; source?: string } = {}): Promise<number> {
    const t = (text || "").trim();
    if (!userId || t.length < 30) return 0;
    let raw = "{}";
    try {
      const r = await fetch(OLLAMA_GEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EXTRACT_MODEL,
          stream: false,
          format: "json",
          options: { temperature: 0.1 },
          prompt:
            `Sei un estrattore di MEMORIE durevoli su un utente. Dal messaggio estrai SOLO fatti o preferenze STABILI e utili a lungo termine ` +
            `(preferenze, abitudini, dati personali, vincoli, decisioni durature). IGNORA richieste momentanee, domande, compiti una-tantum, chiacchiere. ` +
            `Rispondi SOLO JSON: {"memories":[{"content":"<fatto conciso, in italiano, in terza persona>","type":"semantic|episodic|procedural","importance":1-5}]}. ` +
            `Se non c'e' nulla di memorabile: {"memories":[]}.\n\nMessaggio:\n"""${t.slice(0, 3000)}"""`,
        }),
      });
      if (!r.ok) return 0;
      const d = (await r.json()) as { response?: string };
      raw = d.response || "{}";
    } catch (e) {
      this.logger.warn(`[memory] extract failed: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    }
    let mems: { content?: string; type?: string; importance?: number }[] = [];
    try {
      const p = JSON.parse(raw) as { memories?: typeof mems };
      mems = Array.isArray(p.memories) ? p.memories : [];
    } catch {
      return 0;
    }
    let n = 0;
    for (const m of mems.slice(0, 5)) {
      const content = (m?.content || "").toString().trim();
      if (content.length < 4) continue;
      const res = await this.remember(userId, content, {
        projectId: opts.projectId ?? null,
        type: m?.type || "semantic",
        importance: typeof m?.importance === "number" ? m.importance : 3,
        source: opts.source || "extracted",
      });
      if (res.ok && !res.deduped) n++;
    }
    if (n) this.logger.log(`[memory] auto-extracted ${n} memorie per ${userId}`);
    return n;
  }

  private async touch(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "agent_memories" SET last_used_at=now() WHERE id = ANY($1::text[])`,
      ids,
    );
  }
}
