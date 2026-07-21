# Spec architetto — `project-visibility`

> **Historical brief** — task assignment snapshot from 2026-05-12. Kept for record; verify current task/phase state in RoadBoard before acting on it.

**Data brief**: 2026-05-12
**Phase RoadBoard**: *Project Visibility — Per-User Archive & Card UX* (`cmor8wfac`)
**Stato**: in corso (1 task in_progress, 1 done).

## Competenza

Owner di tutto ciò che riguarda visibilità progetto per-utente: archiviazione visiva, card dashboard, filtri lista progetti, snapshot rendering. **Non** tocca permessi/grant globali (rimane su `auth-access` / `grants`).

## Task assegnato

- ID: `cmor8z12v`
- Prompt file: [tasks/run/feat-per-user-archive.md](../tasks/run/feat-per-user-archive.md)
- Priorità: high
- Complessità: M
- Modello consigliato: **Sonnet**

### Obiettivo

Sostituire l'archiviazione globale (`Project.status='archived'`) con un join table `ProjectUserArchive(projectId, userId, archivedAt)`. L'archiviazione diventa filtro per-utente.

### Files toccati

- `packages/database/prisma/schema.prisma`
- `packages/domain`, `packages/api-contracts`
- `apps/core-api/src/modules/projects/*`
- `apps/web-app/src/lib/api.ts`, `src/app/actions.ts`
- `apps/web-app/src/app/dashboard/page.tsx`
- `apps/web-app/src/app/projects/*`

### Acceptance

- Migrazione idempotente via `pnpm db:migrate` (mai `db push`).
- Rimosso `'archived'` dall'union `status`. Valori residui: `draft|active|paused|completed`.
- Endpoint `POST/DELETE /projects/:id/archive` idempotenti.
- Field `archivedForMe: boolean` in `GET /projects`.
- Integration test: due utenti = stati indipendenti sullo stesso progetto.
- UI dashboard nasconde archiviati; pagina projects mostra sezione "Archiviati" + azione *unarchive*.

## Vincoli operativi

- **Non regredire** `SnapError` introdotto in `swipeable-project-card.tsx:37-42, 57-65, 178-198` dal sibling done (`cmor8za30`).
- Container Nest rebuild dopo modifiche DTO/controller (`core-api`).
- Conventional Commits, niente bump versione.

## Su completamento

1. Flip checkbox in `PLAN.md` sotto *Project Visibility — Per-User Archive & Card UX*.
2. `mv tasks/run/feat-per-user-archive.md tasks/done/`.
3. `update_task_status(taskId, 'done')` con `completionReport` dettagliato (file modificati con range linee, tool chiamati, memory scritte).
4. `create_memory_entry` tipo `architecture` se la migrazione introduce pattern riusabile.

## Successivi sblocchi

Nessuno automatico — la phase chiude appena questo task è done.
