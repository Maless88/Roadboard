# IMPL_SUMMARY — real token usage per agente

## Problema
`agents.service.ts` calcolava `tokensApprox = sum(chars/4)` per tutti i run completati.
`chars` conta solo i caratteri dell'output testuale finale → sottostima ~200x rispetto ai token reali
(ignora input, system prompt, tool round-trip, cache).

## Soluzione scelta: sentinel nel bridge stream

**Opzione valutata e scartata**: leggere il transcript JSONL di Claude CLI dopo il run
→ richiede conoscere il session_id, race condition sul file, path non portabile tra versioni CLI.

**Opzione scelta**: il bridge emette un **sentinel** nella risposta HTTP streaming
(`\n__rb_tok__:{...}`) dopo il testo del risultato, estratto dall'evento `result` dello
stream-json di Claude CLI (`ev.usage.input_tokens`, `ev.usage.output_tokens`,
`ev.usage.cache_creation_input_tokens`, `ev.usage.cache_read_input_tokens`).
L'executor intercetta e rimuove il sentinel prima di cederlo ai consumer, popola un
`AgentRunSidecar` opzionale. I caller (controller, orchestrator) leggono il sidecar
e aggiungono i nuovi campi al metadata dell'evento `agent.run.completed`.

## File modificati

| File | Modifica |
|------|----------|
| `scripts/agent-cli-bridge.mjs` | Emette `\n__rb_tok__:{in,out,cc,cr}` dopo `ev.result` |
| `packages/agent-runtime/src/agent-executor.ts` | Nuovi tipi `AgentUsage`, `AgentRunSidecar`; `stream()` + `streamCli()` accettano `sidecar?`; strip sentinel e fill sidecar nel loop di lettura |
| `apps/core-api/src/modules/agents/agents.controller.ts` | Passa `sidecar` a `executor.stream()`; aggiunge `tokensIn/Out/CacheCreate/CacheRead/Total` al metadata `agent.run.completed` |
| `apps/core-api/src/modules/agents/rooms-orchestrator.service.ts` | Idem per loop principale (accumulo su più iterazioni) e per run delegati; aggiunge campi token ai due `agent.run.completed` (principale + delegato) |
| `apps/core-api/src/modules/agents/agents.service.ts` | `tokensApprox` usa `tokensTotal` reale quando presente (fallback `chars/4`); aggiunge `tokensHaveReal: boolean` alle stats |
| `apps/web-app/src/lib/api.ts` | `AgentProfile.stats.tokensHaveReal?: boolean` |
| `apps/web-app/src/app/agents/[slug]/page.tsx` | Label "Token" (senza ~) quando `tokensHaveReal` |
| `apps/web-app/src/app/home/home-client.tsx` | Label card condizionale; `ActivityDetail` mostra breakdown completo `in/out/cache_wr/cache_rd` quando reale, fallback `~chars/4` per eventi vecchi |

## Campi aggiunti al metadata `agent.run.completed`

```json
{
  "ok": true,
  "durationMs": 1234,
  "chars": 500,
  "tokensIn": 1200,
  "tokensOut": 180,
  "tokensCacheCreate": 0,
  "tokensCacheRead": 900,
  "tokensTotal": 2280
}
```

`chars` rimane (compatibilità backward). I campi `tokens*` sono presenti solo se il bridge
ha emesso usage (run CLI in stream mode). Per run schedulati (`source !== "chat"`), il bridge
usa `--output-format text` (non stream-json) → il sentinel non viene emesso → fallback `chars/4`.

## Come testare

1. Ricostruire `core-api` e riavviare il bridge (non eseguito in questo worktree):
   ```bash
   docker compose -f infra/docker/docker-compose.yml build core-api
   docker compose -f infra/docker/docker-compose.yml up -d --no-deps core-api
   # bridge non va riavviato (plain Node, carica il file direttamente)
   ```
2. Aprire Boardchat e mandare un messaggio a qualsiasi agente CLI (es. Ada/Dev).
3. In `ActivityEvent` DB (tabella `activity_event`), cercare l'evento `agent.run.completed`
   più recente e verificare che `metadata` contenga `tokensIn`, `tokensOut`, `tokensTotal`.
4. Aprire la scheda agente (`/agents/<slug>`) e verificare:
   - Label "Token" senza ~ se `tokensHaveReal` = true
   - Valore numerico reale
5. Aprire il dettaglio di un'attività nella Home → verificare breakdown `in/out/cache_wr/cache_rd`.

## Rischi e limitazioni

- **Run non-stream** (`source !== "chat"`, run schedulati via worker-jobs): il bridge non usa
  stream-json → nessun sentinel → nessun usage reale → fallback `chars/4`. Per coprire anche
  questi run occorre aggiungere un endpoint separato al bridge che esegue senza stream e
  ritorna JSON `{result, usage}`. Non fatto qui per minimizzare il blast radius.
- **Chunk boundary**: il sentinel potrebbe in teoria arrivare spezzato su due read(). Il codice
  nel executor gestisce questo caso con un trail buffer di `len(sentinel)` caratteri.
- **Claude CLI versione**: l'`usage` nell'evento `result` dello stream-json è disponibile
  almeno dalla versione 0.x recente. Se il CLI non emette `ev.usage`, il sentinel non viene
  scritto e il sistema degrada silenziosamente al fallback `chars/4`.
- **Backward compat**: eventi storici senza `tokensTotal` continuano a usare `chars/4`
  (fallback garantito). La UI mostra "Token ~" per quegli eventi.
