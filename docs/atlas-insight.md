# Spec architetto — `atlas-insight`

> **SUPERSEDED (2026-05-12)** — la review AI-P0-00 ([atlas-insight-review.md](atlas-insight-review.md))
> ha chiuso il gate decisionale cancellando le phase P1→P6. Questo brief resta come
> record storico del piano originale; non è un piano di esecuzione attivo.

**Data brief**: 2026-05-12
**Wave**: Atlas Insight (phase P0→P6, 7 phase planned, ~40 task)
**Stato**: cancellata (P1→P6) dall'esito della review AI-P0-00.

## Competenza

Owner della wave Atlas Insight: introduzione del node type `feature` in Atlas, linking feature↔code (manuale + suggestions MCP), impact analysis fusion, UI overlay, worker di verification. **Non** tocca il backbone CodeFlow/Memgraph (è di `codeflow-gdb`).

## Task assegnato

- ID: `cmoiab2x4`
- Titolo: **AI-P0-00 — Wave review: ragionamento critico sull'utilità di Atlas Insight**
- Priorità: high
- Complessità: S (è meta, non scrive codice)
- Modello consigliato: **Opus** (analisi cross-domain, blast radius su ~40 task downstream)

### Natura del task

**Strategico, non implementativo.** Output = memory entry tipo `decision`. Nessuna modifica al codice.

### Domande da affrontare

1. Atlas Insight è ancora prioritario vs backlog corrente? Alternative scartate?
2. `feature` come node type vs riuso di `domainGroup`?
3. MCP suggestions vale la complessità (client esterno + circuit breaker + project mapping) o basta MVP manuale P1+P2?
4. `feature_code_links` separato (Option B) vs estensione `architecture_links` (Option A), alla luce del lavoro già fatto su outbox/drift?
5. Quali AC delle 7 phase sono ancora misurabili oggi?
6. Sovrapposizione con Wave 6 (Deep Code Map)?
7. **Impact-view UX**: serve impact-view generalizzata su qualsiasi `ArchitectureNode` (era CF-17, cancellata) oltre alla P5-02 feature-centric?

### Documenti di riferimento

- [docs/analysis/roadboard-atlas-socraticode-feasibility.md](analysis/roadboard-atlas-socraticode-feasibility.md)
- [docs/analysis/atlas-insight-implementation-plan.md](analysis/atlas-insight-implementation-plan.md)
- Memory `cmoiqkbre` *Backlog triage 2026-04-28* (contesto domanda 7).

### Sibling task da valutare contestualmente

- P0-01 (drift validation 7gg, high)
- P0-02 (outbox audit, high)
- P0-03 (ImpactAnalysis behavior, medium)

La review deve dire se restano sensati o decadono insieme alla wave.

## Output atteso

1. **Memory entry tipo `decision`** con verdetto fra: `procedere` / `ridurre scope` / `fondere con Wave 6` / `posticipare` / `killare`.
2. Se *procedere*: aggiornamento priorità/scope di P1→P6 prima di lanciare P0-01.
3. Se *killare/posticipare*: `update_phase(status='cancelled')` per P0→P6 con motivazione + eventuale ricreazione task ex-CF-17 (impact-view generalizzata) se serve UI per CF-GDB-04.
4. **Vincolo bloccante**: nessuna esecuzione di AI-P0-01 senza questo task `done`.

## Cosa NON fare

- Non scrivere codice.
- Non aprire P1 (creare prompt P1-01..P1-07) prima del verdetto.
- Non riproporre lo scope originale "per inerzia" — il task esiste proprio per evitarlo.

## Successivi sblocchi (condizionali)

- Verdetto *procedere* → coordinatore promuove P0-01/02/03 come tre brief paralleli all'architetto.
- Verdetto *ridurre/fondere* → coordinatore esegue triage backlog Atlas Insight + crea nuova phase di scope ridotto.
- Verdetto *killare* → coordinatore chiude tutte le phase Atlas Insight, valuta CF-17 generalizzata.
