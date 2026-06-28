-- Durable agent memory (mem0-style) on pgvector. Per-user / per-project scope.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "agent_memories" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"      text NOT NULL,
  "project_id"   text,                         -- NULL = memoria globale dell'utente
  "scope"        text NOT NULL DEFAULT 'user', -- 'user' | 'project'
  "type"         text NOT NULL DEFAULT 'semantic', -- semantic | episodic | procedural
  "content"      text NOT NULL,
  "embedding"    vector(768),                  -- nomic-embed-text
  "importance"   int  NOT NULL DEFAULT 3,      -- 1..5
  "source"       text,                         -- 'explicit' | 'extracted' | <agent slug>
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "agent_memories_scope_idx" ON "agent_memories" ("user_id", "project_id");
CREATE INDEX IF NOT EXISTS "agent_memories_embed_idx" ON "agent_memories" USING hnsw ("embedding" vector_cosine_ops);
-- fallback keyword search (se l'embedding manca / per ibrido)
CREATE INDEX IF NOT EXISTS "agent_memories_fts_idx" ON "agent_memories" USING gin (to_tsvector('simple', "content"));
