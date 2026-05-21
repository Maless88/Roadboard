# Atlas Insight — Wave Review (AI-P0-00)

**Data**: 2026-05-12
**Autore**: Worker `atlas-insight` (sessione architect-delegated)
**Input task**: `cmoiab2x4` — *AI-P0-00 Wave review: ragionamento critico sull'utilità di Atlas Insight*
**Documenti analizzati**:
- `docs/analysis/roadboard-atlas-socraticode-feasibility.md`
- `docs/analysis/atlas-insight-implementation-plan.md` (7 phase, ~30 task AI-Pn-mm)
- `docs/audit-2026-05-12.md`
- Prompt vivi nel backlog correlato (`tasks/todo/feat-cf-19/20/21/22/23-*.md`, `rework-cf-gdb-03b-*.md`)
- Stato codice (verificato via Serena/Grep): `apps/core-api/src/modules/codeflow/`, `packages/graph-db/src/schema.ts`, schema Prisma

---

## Verdetto

**`ridurre scope`** — con due tagli netti:

1. **Phase 0 (P0-01 / P0-02 / P0-03) sopravvive e si promuove a tre brief paralleli** (drift validation 7gg, outbox audit, ImpactAnalysis behavior). Questi lavori sono *igiene operativa* del backbone CodeFlow attuale: hanno valore **a prescindere** dall'esito finale della wave Atlas Insight e sono prerequisiti anche per CF-GDB-03b e CF-19. Non li si paga "per la wave"; li si paga "per avere un Atlas affidabile" tout-court.

2. **Phase 1 → Phase 6 (~30 task AI-P1..P6) NON si avvia in questa forma.** Il sotto-set residuo viene riassorbito in due tronchi distinti:
   - **CF-22 (`domainGroup` first-class)** — diventa l'evoluzione semantica preferita rispetto a un nuovo `node.type='feature'`. CF-22 era già `blocked` in attesa di questa review: con il presente verdetto si **sblocca** ed entra in pipeline come sostituto di P1-01/02/03/04 (feature node + canvas palette).
   - **Wave 6 — Deep Code Map (ts-morph scanner, `File`/`Symbol` nodes, dipendenze native)** assorbe l'idea "granularità sotto file" e "impact analysis fusion". È già pianificata come phase indipendente nell'audit (`deep-code-map` come architetto separato) e copre **lo stesso bisogno** che P1-04/P1-05 + P3 + P4 cercavano di soddisfare via MCP esterno, ma con una soluzione **locale, deterministica, senza circuit breaker**.

**Cancellate formalmente**: phase Atlas Insight P1, P2, P3, P4, P5, P6 nella loro attuale formulazione (~30 task). Il "FeatureCodeLink table + MCP suggestions + Insight tab + impact fusion + verifier worker" non si esegue.

**Da ricreare**: un task ex-CF-17 (*Impact-view generalizzata su qualsiasi `ArchitectureNode`*) **sì**, per dare un consumer UI al `getImpact()` Cypher-nativo prodotto da CF-GDB-04. Senza UI quel backend resta orfano. Vedi §Piano d'azione.

---

## Risposta argomentata alle 7 domande

### 1. Atlas Insight è ancora prioritario vs backlog corrente?

**No, non nella forma proposta.** L'audit 2026-05-12 fotografa:

- **116 task done**, 61 todo, 9 cancelled, 1 in_progress, 1 blocked. Backlog già denso.
- L'unica wave in corso è *Project Visibility — Per-User Archive*. CF-GDB phase 2 (read swap a Memgraph) non è ancora partita: `tasks/todo/rework-cf-gdb-03b-memgraph-read-swap.md` è il *lynch-pin* dichiarato del backlog CodeFlow.
- 7 phase planned competono per priorità (Atlas Insight P0→P6 + Wave 5.2 + Wave 5.3 + Wave 6 Deep Code Map).

Atlas Insight è stato concepito (vedi `roadboard-atlas-socraticode-feasibility.md` §1) come "**phased extension** rather than a refactor" che **deferiva esplicitamente l'inizio** finché "current Atlas-related work stabilises (drift detection, graph-sync outbox, recent CodeFlow tasks landed)". Quel prerequisito **non è ancora soddisfatto**: drift è in osservazione (CF-GDB-03c appena landed, P0-01 chiede di validarlo per 7gg consecutivi); CF-GDB-03b read-swap non è iniziato.

Avviare Phase 1 oggi significa **stackare un nuovo data model (`feature_code_links`) + nuovo label Memgraph (`:CodeArtifact`) + nuovo edge type (`LINKED_CODE`)** sopra un dual-store che sta ancora consolidando i suoi invarianti. Aumenta la superficie di drift proprio mentre P0-01 prova a dimostrare che la drift è zero. Anti-pattern.

**Alternative scartate**:
- *Procedere integrale* — pagherebbe ~30 task per un'ipotesi (utilità di `feature` come node type, valore di MCP suggestions) non validata da nessun field signal. L'audit non riporta nessuna richiesta utente per "feature node type" o "code-link suggestions automatiche".
- *Killare totale* — sprecherebbe il lavoro di analisi e ignorerebbe che P0-01/02/03 valgono comunque.
- *Posticipare in blocco* — lascerebbe il backlog ingombro di 7 phase planned non azionabili, accumulando debito decisionale.

**Backlog corrente con priorità più alta**:
- CF-GDB-03b read swap (rework, lynch-pin)
- CF-GDB-04 impact analysis Cypher-nativa
- CF-19/20/21/23 (snapshot, decision-aware graph, agent context panel, handoff snapshot) — già scritti e non bloccati, sono *agent-native differentiation*, non *code intelligence*
- W4-06 invite flow, audit-01 AuditEvent
- Wave 6 Deep Code Map ADR (`cmobns6pg` — parallelo, Sonnet)

### 2. `feature` come node type vs riuso di `domainGroup`?

**Riusare `domainGroup`. Niente `feature` come nuovo node type.**

Argomenti:

- `ArchitectureNode.domainGroup` **esiste già** nello schema Prisma (verificato: `apps/core-api/src/modules/codeflow/graph.service.ts`, `graph-sync.service.ts`, DTO create/update). Aggiungere un secondo asse semantico (`type='feature'`) significa **due modi di taggare la stessa cosa**, con regole di disambiguazione ad-hoc.
- Il documento di feasibility §3.2 lo dice in chiaro: *"`domainGroup` is the closest thing to a 'product feature' tag... but there is no UI surfacing it as a first-class facet"*. Il problema reale non è il modello dati, è la **UX**: nessuno vede `domainGroup` in canvas, nessuno può crearlo/rinominarlo, nessuno può fare drag-drop.
- CF-22 (`tasks/todo/feat-cf-22-domain-grouping.md`) era stato scritto proprio per questo: CRUD `domainGroup` + drag-drop + legenda colori. **Era bloccato in attesa di P0-00 esattamente per la presente domanda**. Sbloccarlo è la conseguenza naturale.
- `node.type` è un'astrazione strutturale (cos'è il nodo: app/package/module/file/service). `domainGroup` è un'astrazione semantica (a quale dominio di prodotto appartiene). Mescolarli in `type` rompe l'invariante.
- Side effect positivo: rimuovere `feature` come node type rende inutili anche P1-02 (validator), P1-03 (palette canvas), e gran parte di P2 (Insight tab gated su `node.type='feature'`).

**Conseguenza**: CF-22 si sblocca e diventa il task canonico per "feature graph UX".

### 3. MCP suggestions vale la complessità?

**No. Il MVP manuale (originariamente P1+P2) decade insieme al resto della wave** perché basato sulla premessa "esistono feature nodes da linkare". Tolto il `feature` node type (domanda 2), il flusso "suggest code links per la feature X" perde il suo soggetto.

Anche in astratto (immaginando di riformularlo come "suggest code links per qualsiasi `ArchitectureNode`"), il rapporto costo/beneficio è negativo nel contesto corrente:

- **Costo**: client MCP esterno (SocratiCode-like), circuit breaker, project↔SocratiCode id mapping, env config, ADR transport choice, gestione errori, banner UX, accept/reject memory, audit-log su accept, RBAC, observability. AI-P3 da solo è 10 task con complexity media L.
- **Beneficio**: suggerimenti link che l'utente potrebbe creare a mano. Nessun field signal indica che il bottleneck reale degli utenti sia *"creare link manuali è troppo lento"*. Anzi: l'audit segnala phase `UX Fixes` bloccata su problemi base (theme toggle, project switcher, rename Members→Contributors, Markdown rendering, onboarding ingest automatico). Quelli sono i bottleneck attivi.
- **Dipendenza**: presuppone l'esistenza e l'affidabilità di un servizio MCP esterno (SocratiCode o equivalente) che oggi **non è deployato**. Il "feature flag a livello progetto" è un workaround che ammette implicitamente che la dipendenza è instabile.
- **Wave 6 fa meglio lo stesso lavoro**: il Deep Code Map scanner (ts-morph) produce localmente la mappa `File → Symbol → import` con confidence 1.0 e zero dipendenze esterne. Per il monorepo TypeScript di Roadboard è la soluzione corretta. SocratiCode-like è ottimizzato per repo *poliglotti* dove un parser per-language non è sostenibile — non è il caso d'uso di Roadboard.

**Conclusione**: Phase 3 si cancella. Il caso d'uso "suggerimenti automatici" viene catturato in modo deterministico da Wave 6 (ts-morph genera direttamente i `File`/`Symbol` nodes + edges; nessun "suggerimento" — sono fatti).

### 4. `feature_code_links` (Option B) vs estensione `architecture_links` (Option A)?

**Decisione differita; nessuna delle due si esegue ora.**

Motivo: la nuova tabella `feature_code_links` esiste *per portare confidence + provenance + staleness su link Atlas → code artifact*. Tolto il bisogno (domande 2 + 3 + 5), la tabella è prematura.

Per il dopo (Wave 6 Deep Code Map):
- Wave 6 introdurrà nodes `File` e `Symbol` come **veri `ArchitectureNode`** (tipi nuovi nel validator, non entità di tipo diverso). Le relazioni tra essi sono **`ArchitectureEdge`** native, non "link a entità esterne".
- Il bisogno di "questo `File` esiste ancora a HEAD?" (staleness) diventa una proprietà del nodo stesso (`status='stale' | 'active'` su `ArchitectureNode`), non di una tabella di link.
- "Provenance" diventa `isManual: false` + `metadata.source='ts-morph-scan-<timestamp>'` — pattern già supportato.

Quindi: **né Option A né Option B**. La domanda perde senso una volta che il problema viene risolto da Wave 6 con i meccanismi esistenti (`ArchitectureNode` + `ArchitectureEdge` + `metadata Json`).

Outbox + drift già implementati lavorano *a favore*: ogni nuovo edge type passa già per `GraphSyncEvent`, non c'è da reinventare il sync. Aggiungere una tabella `feature_code_links` parallela rompe questa simmetria; restare dentro `ArchitectureNode/Edge` la conserva.

### 5. Quali AC delle 7 phase sono ancora misurabili oggi?

Audit fatto per phase:

| Phase | AC | Misurabilità oggi |
|-------|----|-------------------|
| P0 — Stabilization | drift zero 7gg, outbox backlog stabile, `getImpact ≤500ms p95` | **Sì, misurabile.** Endpoint `/codeflow/graph/drift` esiste (CF-GDB-03c), outbox table esiste, `ImpactAnalysis` precomputation esiste. È l'unica phase che ha senso eseguire ora. |
| P1 — Feature modeling | migration applica clean, `node.type='feature'` accettato, palette renderizza | Tecnicamente misurabile ma misura cosa? Crea un nuovo node type senza un consumer reale. Vacuous AC. |
| P2 — Manual linking | create/delete round-trip, source='manual' | Misurabile, ma valore zero se non c'è il consumer (vedi P5). |
| P3 — MCP suggestions | "5–10 suggestions in ≤2s p95 on seeded project" | **Non misurabile oggi.** Non esiste un'istanza SocratiCode deployata. AC parla di "seeded project" che non esiste. |
| P4 — Impact fusion | "≤1.5s p95, degrade gracefully" | Misurabile *solo dopo* P3. Pre-CF-GDB-04 anche `ImpactAnalysis` lato Atlas è in transizione. |
| P5 — UI overlay | "FPS ≥30 on 200-node project" | Misurabile ma di nuovo: gated su esistenza dei dati di P3/P4. Empirica solo dopo. |
| P6 — Automation | "stale flagged within 24h", "false positive ≤1%" | Misurabile solo dopo P3 stabile per ≥2 settimane (è scritto esplicitamente nel plan §Execution Strategy). |

**Sintesi**: solo P0 è misurabile *adesso*. Da P3 in poi gli AC dipendono da una dipendenza esterna non esistente. P1+P2 sono misurabili ma testano *self-consistency*, non valore: passano gli AC senza dimostrare che il lavoro serve.

### 6. Sovrapposizione con Wave 6 (Deep Code Map)?

**Sovrapposizione massiva e a favore di Wave 6.**

Atlas Insight piano:
- `feature_code_links` con `artifactType ∈ {file, symbol, endpoint, component, test, commit, pr}`.
- Linking feature → file/symbol manuale + suggerito via MCP esterno.
- Impact analysis che fonde Atlas-native + `codebase_graph_query` esterno.

Wave 6 Deep Code Map (per audit + scope `deep-code-map` architetto):
- Scanner **ts-morph locale** che produce nodi `File` e `Symbol` come `ArchitectureNode`.
- Edge tra essi (`IMPORTS`, `CALLS`, `DEPENDS_ON`) generati deterministicamente.
- Impact analysis nativa via Cypher reverse-BFS su Memgraph (CF-GDB-04, già pianificato).

Confronto:

| Capability | Atlas Insight (proposto) | Wave 6 (pianificato) |
|------------|--------------------------|----------------------|
| File-level nodes | sì, ma fuori da `ArchitectureNode` (`feature_code_links`) | sì, come `ArchitectureNode.type='file'` (estende il validator esistente con il `symbol` già stylato nel canvas) |
| Symbol-level | sì, via MCP | sì, locale ts-morph |
| Linking manual | sì | non serve: i link sono dedotti dal codice |
| Linking automatic | MCP esterno (circuit breaker, fragilità) | scanner locale (deterministico) |
| Impact analysis | fusion con MCP graph_query | Cypher-nativa, CF-GDB-04 |
| Staleness | verifier worker BullMQ | re-scan idempotente |
| Costo deployment | servizio MCP separato | nessuno |

Wave 6 fa **lo stesso lavoro meglio** per il monorepo TypeScript di Roadboard. Atlas Insight aveva senso come "integrazione SocratiCode-like" quando si pensava a una soluzione *language-agnostic*; ma il target reale è il monorepo casa, e per quello ts-morph batte qualunque scanner esterno in 4 metriche su 4 (latency, determinism, dependency, cost).

**Conseguenza**: ciò che resta utile della spec Atlas Insight (la *UX*: drawer tab con code-links, impact view, staleness badge) viene **assorbito in Wave 6** come UI di consumo dei suoi output.

### 7. Impact-view UX (ex CF-17): serve una vista generalizzata oltre la P5-02 feature-centric?

**Sì, e diventa critica** una volta cancellata P5-02.

Contesto: CF-17 era una "impact-view generalizzata su qualsiasi `ArchitectureNode`" cancellata nel triage backlog 2026-04-28 (memory `cmoiqkbre`). Il motivo del cancellamento era *"l'impact-view feature-centric di P5-02 la rimpiazza"*. Killando P5-02, il motivo decade.

Inoltre CF-GDB-04 (impact analysis Cypher-nativa) sta producendo **il backend** dell'impact view: reverse-BFS su Memgraph, restituisce nodi/edges affetti da un cambio. Senza UI quell'endpoint è orfano (consumabile solo via MCP). Per gli utenti web-app dell'Atlas tab, "what breaks if I change X" è una domanda con valore *evidente* (l'audit lo cita come use case sotto-servito).

**Conseguenza**: ricreare un task ex-CF-17 — *Impact-view generalizzata in node-drawer per qualsiasi `ArchitectureNode`*. Consumer: `GET /codeflow/graph/nodes/:id/impact` (già esistente, ma con backend Cypher-nativo post CF-GDB-04). UI: nuova tab `impact` nel node-drawer accanto a `info | decisions | tasks | memory | links`. Niente Wave 6 in pre-requisito: funziona già con i nodi attuali (`app | package | module | service | file`); diventa ancora più utile quando Wave 6 aggiunge `File`/`Symbol`.

---

## Piano d'azione conseguente

### Azione immediata (questa sessione coordinator)

1. **Scrivere questo file** come output del task `cmoiab2x4` (`docs/atlas-insight-review.md`). ✓ (fatto)
2. **Aggiornare RoadBoard** (offline in questa sessione Worker — è onere del coordinator alla ricezione):
   - `update_task_status(cmoiab2x4, done)` con `completionReport` che linka il file.
   - `create_decision` di livello `high` con titolo *"Atlas Insight: ridurre scope, fondere con Wave 6"* e outcome che riassume il verdetto.
   - `create_memory_entry` di tipo `decision` con i criteri della scelta (per discoverability futura).

### Phase Atlas Insight da chiudere formalmente

`update_phase(status='cancelled', reason=...)` per:

- **Phase 1 — Feature Modeling Foundation** — cancelled. Motivazione: `domainGroup` (riuso) + Wave 6 (`File`/`Symbol` come `ArchitectureNode.type`) coprono lo scope senza nuova tabella.
- **Phase 2 — Manual Feature↔Code Linking** — cancelled. Motivazione: nessun `feature` node type → niente da linkare manualmente. Manual linking sopravvive come capability *già esistente* via `ArchitectureLink` (entityType={task,decision,milestone,memory_entry}).
- **Phase 3 — MCP Suggestions** — cancelled. Motivazione: Wave 6 scanner locale produce gli stessi nodi/edge deterministicamente; servizio MCP esterno non vale il costo per un monorepo TS interno.
- **Phase 4 — Impact Fusion** — cancelled. Motivazione: CF-GDB-04 produce impact Cypher-nativo; nessuna fusione esterna necessaria. UI: nuovo task ex-CF-17 (sotto).
- **Phase 5 — UI Enrichment** — cancelled, *ma* P5-02 (impact view) si reincarna in **nuovo task ex-CF-17** generalizzato. P5-01 (Insight status banner) e P5-03 (overlay tecnico) si cancellano: senza il `CodeContextModule` non c'è nulla da bannerizzare/overlayare.
- **Phase 6 — Automation** — cancelled. Motivazione: nessuna `feature_code_links` table da verificare; staleness su `File` nodes diventa un job di re-scan Wave 6 (se serve), non un worker dedicato.

### Phase Atlas Insight da promuovere (resta solo P0)

**Phase 0 — CodeFlow Stabilization** rimane attiva e si scompone in tre brief paralleli:

| Task ID | Titolo | Priorità | Modello | Architetto suggerito |
|---------|--------|----------|---------|----------------------|
| AI-P0-01 | Validate Postgres↔Memgraph drift 7gg | high | Sonnet | atlas-insight (rinominabile `codeflow-stabilization`) |
| AI-P0-02 | Audit `GraphSyncEvent` outbox stuck/failing | high | Sonnet | idem |
| AI-P0-03 | ImpactAnalysis precomputation behavior | medium | Sonnet | idem |

Nota: il nome "Atlas Insight" della phase può essere rinominato a *"CodeFlow Stabilization"* — il branding originale Atlas Insight non ha più senso visto che la wave omonima è cancellata. Decisione di rename: lasciata al coordinator.

### Backlog correlato da sbloccare

- **CF-22 (`feat-cf-22-domain-grouping.md`)** — RIMUOVERE il blocco. Diventa il task canonico per la feature graph UX. Rinome possibile: `feat-cf-22-domain-grouping → feat-cf-22-feature-grouping` (cosmetico). Promosso a high.

### Nuovo task da creare (ex CF-17)

- **CF-17R — Impact view generalizzata in node-drawer**
  - Description: nuova tab `impact` nel `node-drawer.tsx`, attiva per qualsiasi `ArchitectureNode`. Consuma `GET /codeflow/graph/nodes/:id/impact` (backend reso Cypher-nativo da CF-GDB-04). Mostra: nodi direttamente impattati, indiretti (≤3 hop), trasitivi (>3); link click → naviga al nodo.
  - Dependencies: CF-GDB-03b (read swap), CF-GDB-04 (Cypher reverse-BFS).
  - Priority: medium (post CF-GDB-04).
  - Complexity: M.
  - Files: `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`, `apps/web-app/src/lib/api.ts`.

### Audit / pulizia documentazione

- `docs/analysis/atlas-insight-implementation-plan.md` — non cancellare. Annotare con un banner in cima: *"Plan superato dal verdetto AI-P0-00 (`docs/atlas-insight-review.md`, 2026-05-12). Riferimento storico."*
- `docs/atlas-insight.md` (brief architetto) — chiudibile post-handoff.

### Sequenza esecutiva consigliata (post-review)

1. P0-01/02/03 in parallelo (atlas-insight architect, 3 brief Sonnet).
2. CF-GDB-03b read swap (codeflow-gdb, Opus) — sblocca CF-GDB-04 → CF-17R.
3. CF-22 domain grouping (atlas o codeflow architect, Sonnet, dopo P0-01 done).
4. Wave 6 Deep Code Map ADR (deep-code-map, Sonnet, parallelo).
5. CF-19 architecture snapshot MCP tool (post CF-GDB-03b done; `topImpactNodes` placeholder se CF-GDB-04 ancora in corso).

---

## Vincolo bloccante (rispettato)

Nessuna esecuzione di **AI-P0-01** è stata avviata. Nessun codice Atlas Insight è stato scritto. Nessun prompt P1-* è stato creato in `tasks/todo/`. Filesystem `tasks/` ispezionato all'apertura sessione:

- `tasks/run/`: solo `feat-per-user-archive.md` (track A, non-Atlas).
- `tasks/todo/`: 8 prompt, **nessuno** è `AI-P0-00` (il task non era stato ancora promosso a prompt file — questa review chiude la fase decisionale prima che il prompt venisse mai scritto).
- `tasks/done/`: 4 prompt landed, nessuno Atlas Insight.

Nessuna modifica filesystem operativa fatta da questo Worker — solo creato `docs/atlas-insight-review.md`.

---

## Output strutturato per il coordinator

**Verdetto**: `ridurre scope`.

**File**: `/home/alessio/work/rb/docs/atlas-insight-review.md`.

**Azioni concrete**:

1. **Chiudere** (cancelled) phase Atlas Insight P1, P2, P3, P4, P5, P6.
2. **Mantenere** phase Atlas Insight P0 (eventuale rename → "CodeFlow Stabilization"); promuovere AI-P0-01/02/03 a tre brief Sonnet paralleli.
3. **Sbloccare** CF-22 (`tasks/todo/feat-cf-22-domain-grouping.md`) rimuovendo il banner `⛔ BLOCKED` e portandolo a high priority.
4. **Creare** task CF-17R *Impact-view generalizzata in node-drawer* (dipende da CF-GDB-04, medium, M).
5. **Annotare** `docs/analysis/atlas-insight-implementation-plan.md` con banner di superamento.
6. **Registrare** in RoadBoard: `update_task_status(cmoiab2x4, done)` + `create_decision` + `create_memory_entry` con verdetto.
7. **Nessun prompt P1..P6** da creare. Nessun migration `feature_code_links` da scrivere.
