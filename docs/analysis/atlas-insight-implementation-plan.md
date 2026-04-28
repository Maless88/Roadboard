# Atlas Insight Implementation Plan

> Execution plan derived from [roadboard-atlas-socraticode-feasibility.md](./roadboard-atlas-socraticode-feasibility.md).
> User-facing name: **Atlas Insight**. Backend modules: `CodeContextModule`, `FeatureLinkerService`, `InsightService`. DB table: `feature_code_links`.

---

## Phases

### Phase 0 — CodeFlow Stabilization
- **Goal:** ensure Atlas's Postgres↔Memgraph pipeline is healthy before stacking new layers on top.
- **Description:** Validate drift detection, outbox sync resilience, and impact precomputation on existing CodeFlow code. No new features.
- **Depends on:** —

### Phase 1 — Feature Modeling Foundation
- **Goal:** introduce the `feature` Atlas node type and the `feature_code_links` persistence layer.
- **Description:** Schema migration, validator updates, baseline CRUD on `feature_code_links` (no MCP yet, no UI yet).
- **Depends on:** Phase 0.

### Phase 2 — Manual Feature ↔ Code Linking
- **Goal:** users link feature nodes to code artifacts manually from the Atlas drawer.
- **Description:** REST + server actions + a read/write "Insight" tab in the node drawer with manual link entry.
- **Depends on:** Phase 1.

### Phase 3 — Atlas Insight Suggestions (MCP Integration)
- **Goal:** call an external MCP-based code intelligence system to suggest links for feature nodes.
- **Description:** New `CodeContextModule` in core-api hosting `FeatureLinkerService` + `InsightService`. Suggestions are persisted only on user accept, with `source='mcp'` + confidence.
- **Depends on:** Phase 2.

### Phase 4 — Impact Analysis Fusion
- **Goal:** combine Atlas's existing `ImpactAnalysis` with code-graph traversals from Atlas Insight.
- **Description:** Backend endpoint + service merging both sources with provenance per item; no UI overlay yet.
- **Depends on:** Phase 3.

### Phase 5 — UI Enrichment (Insight Tab + Overlays)
- **Goal:** richer Atlas UX: dedicated Insight tab, technical-dependency overlay on canvas, status header.
- **Description:** Visual layer on top of phases 2–4. Stale/confidence badges, canvas overlay toggle, Insight status banner.
- **Depends on:** Phase 4.

### Phase 6 — Automation and Verification
- **Goal:** keep links fresh and pre-compute suggestions for new feature nodes.
- **Description:** Background workers (BullMQ), staleness verifier, auto-suggestion on feature creation, optional CI hook.
- **Depends on:** Phase 5.

---

## Tasks by Phase

### Phase 0 — CodeFlow Stabilization

- [ ] **Task ID:** AI-P0-01
  **Title:** Validate Postgres↔Memgraph drift on all active projects for 7 days
  **Description:** Run `GET /projects/:id/codeflow/graph/drift` daily on every active project. Track results, root-cause any divergence, fix, repeat until 7 consecutive zero-drift days.
  **Phase:** Phase 0
  **Dependencies:** —
  **Acceptance Criteria:** zero drift events for 7 consecutive days across all `status='active'` projects; report stored as a memory entry on the Roadboard project.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/drift.service.ts`, `apps/core-api/src/modules/codeflow/graph.controller.ts`

- [ ] **Task ID:** AI-P0-02
  **Title:** Audit `GraphSyncEvent` outbox for stuck or failing entries
  **Description:** Inspect `graph_sync_events` rows with `status != 'processed'` or `attempts > 3`; fix root causes; add alert if backlog grows > N.
  **Phase:** Phase 0
  **Dependencies:** —
  **Acceptance Criteria:** outbox backlog stays < 50 events for 7 consecutive days; alert wired in observability.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/graph-sync.service.ts`, `apps/core-api/src/modules/codeflow/graph-sync.service.spec.ts`

- [ ] **Task ID:** AI-P0-03
  **Title:** Confirm `ImpactAnalysis` precomputation behavior under repeated snapshots
  **Description:** Take 5 successive snapshots on a non-trivial project; verify `ImpactAnalysis` rows are bounded, fresh, and consistent with Memgraph traversal.
  **Phase:** Phase 0
  **Dependencies:** —
  **Acceptance Criteria:** documented expected size growth; no orphan `ImpactAnalysis` rows; `getImpact` returns ≤500ms p95 on the largest seeded project.
  **Priority:** medium
  **Complexity:** S
  **Files:** `apps/core-api/src/modules/codeflow/graph.service.ts`, `apps/core-api/src/modules/codeflow/graph.service.spec.ts`

---

### Phase 1 — Feature Modeling Foundation

- [ ] **Task ID:** AI-P1-01
  **Title:** ADR — operational definition of `feature` Atlas node
  **Description:** Author a short ADR specifying granularity, naming, ownership, and the relationship between `node.type='feature'` and `domainGroup`. Output decided in Roadboard via `create_decision`.
  **Phase:** Phase 1
  **Dependencies:** —
  **Acceptance Criteria:** ADR file merged under `docs/design/`; `create_decision` recorded with `impactLevel='high'`; reviewed by product + engineering.
  **Priority:** high
  **Complexity:** S
  **Files:** `docs/design/`

- [ ] **Task ID:** AI-P1-02
  **Title:** Add `feature` to allowed node types
  **Description:** Extend `NODE_TYPES` validator to include `'feature'`. Update tests and any switch/maps that enumerate types.
  **Phase:** Phase 1
  **Dependencies:** AI-P1-01
  **Acceptance Criteria:** `POST /projects/:id/codeflow/graph/nodes` with `type='feature'` succeeds; existing types still pass; unit tests cover new value.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/core-api/src/modules/codeflow/dto/create-node.dto.ts`, `apps/core-api/src/modules/codeflow/graph.service.ts`, `apps/core-api/src/modules/codeflow/graph.service.spec.ts`

- [ ] **Task ID:** AI-P1-03
  **Title:** Add `feature` palette + icon in canvas
  **Description:** Extend `TYPE_COLORS_DARK` and `TYPE_COLORS_LIGHT` palettes to include `feature`; pick visually distinct color from existing types.
  **Phase:** Phase 1
  **Dependencies:** AI-P1-02
  **Acceptance Criteria:** feature nodes render with the new palette in dark and light themes; visual snapshot test updated.
  **Priority:** medium
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/architecture-map-canvas.tsx`

- [ ] **Task ID:** AI-P1-04
  **Title:** Prisma migration — `feature_code_links` table
  **Description:** Add the `FeatureCodeLink` Prisma model with columns `id, projectId, nodeId, artifactType, artifactPath, artifactSymbol, repoRef, lineStart, lineEnd, confidence, source, status, lastVerifiedAt, createdByUserId, createdAt`. Indexes on `(projectId, nodeId)` and `(projectId, artifactType, artifactPath)`. Run `pnpm db:migrate` (NEVER `db push`).
  **Phase:** Phase 1
  **Dependencies:** AI-P1-01
  **Acceptance Criteria:** migration applies cleanly on a fresh DB and on a seeded DB; `prisma validate` green; generated client exposes `feature_code_links`.
  **Priority:** high
  **Complexity:** M
  **Files:** `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/`

- [ ] **Task ID:** AI-P1-05
  **Title:** Memgraph schema — `:CodeArtifact` label + `LINKED_CODE` edge
  **Description:** Extend `SCHEMA_CYPHER` with constraint on `:CodeArtifact(id)` and indexes on `projectId` and `artifactPath`. Document the new edge type.
  **Phase:** Phase 1
  **Dependencies:** AI-P1-04
  **Acceptance Criteria:** `applyGraphSchema` is idempotent and creates the new constraint/index; existing tests still pass.
  **Priority:** high
  **Complexity:** S
  **Files:** `packages/graph-db/src/schema.ts`, `packages/graph-db/src/index.ts`, `packages/graph-db/src/client.spec.ts`

- [ ] **Task ID:** AI-P1-06
  **Title:** `FeatureCodeLinkService` — baseline CRUD (manual only)
  **Description:** Service supporting `create`, `list`, `delete` against `feature_code_links`. Source value forced to `'manual'`. Emits outbox events that Memgraph sync can replay as `(:Feature)-[:LINKED_CODE]->(:CodeArtifact)`.
  **Phase:** Phase 1
  **Dependencies:** AI-P1-04, AI-P1-05
  **Acceptance Criteria:** unit specs cover create/list/delete and outbox emission; existing CodeFlow tests pass; lint + typecheck clean.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/feature-code-links.service.ts`, `apps/core-api/src/modules/codeflow/feature-code-links.service.spec.ts`, `apps/core-api/src/modules/codeflow/codeflow.module.ts`

- [ ] **Task ID:** AI-P1-07
  **Title:** Memgraph sync handler for `feature_code_links`
  **Description:** Extend `graph-sync.service.ts` to translate outbox events for `feature_code_links` into Cypher upserts/deletes against `:CodeArtifact` and `:LINKED_CODE`.
  **Phase:** Phase 1
  **Dependencies:** AI-P1-05, AI-P1-06
  **Acceptance Criteria:** new spec proves Postgres write produces the expected Cypher; drift endpoint returns zero divergence after seeded test data.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/graph-sync.service.ts`, `apps/core-api/src/modules/codeflow/graph-sync.service.spec.ts`, `apps/core-api/src/modules/codeflow/drift.service.ts`

---

### Phase 2 — Manual Feature ↔ Code Linking

- [ ] **Task ID:** AI-P2-01
  **Title:** REST controller — `feature_code_links` endpoints under graph controller
  **Description:** Add `POST /projects/:projectId/codeflow/graph/nodes/:nodeId/code-links`, `GET .../code-links`, `DELETE .../code-links/:linkId`. Gate writes with `CODEFLOW_WRITE`, reads with `CODEFLOW_READ`.
  **Phase:** Phase 2
  **Dependencies:** AI-P1-06
  **Acceptance Criteria:** Nest e2e covers happy paths and grant denials; OpenAPI/contract reflects new endpoints.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/graph.controller.ts`, `apps/core-api/src/modules/codeflow/dto/create-feature-code-link.dto.ts`

- [ ] **Task ID:** AI-P2-02
  **Title:** Web-app proxy route for code-links
  **Description:** Add Next.js route handlers under `apps/web-app/src/app/api/codeflow/nodes/[nodeId]/code-links/` proxying to core-api with the user token, mirroring the existing node detail proxy.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-01
  **Acceptance Criteria:** GET/POST/DELETE round-trip from the browser succeeds against a running stack; auth headers forwarded correctly.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/web-app/src/app/api/codeflow/nodes/[nodeId]/route.ts`, `apps/web-app/src/app/api/codeflow/nodes/[nodeId]/code-links/route.ts`

- [ ] **Task ID:** AI-P2-03
  **Title:** Web-app API client + types for `FeatureCodeLink`
  **Description:** Extend `apps/web-app/src/lib/api.ts` with `listFeatureCodeLinks`, `createFeatureCodeLink`, `deleteFeatureCodeLink`, plus `FeatureCodeLink` TS type.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-02
  **Acceptance Criteria:** typecheck passes; functions are imported from at least one consumer; no use of `any`.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/web-app/src/lib/api.ts`

- [ ] **Task ID:** AI-P2-04
  **Title:** Server actions for code-links
  **Description:** Add `createCodeLinkAction` and `deleteCodeLinkAction` to the existing codeflow actions file, mirroring the `createNodeLinkAction` pattern.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-03
  **Acceptance Criteria:** server actions return `{ ok }` / `{ error }` shape consistent with existing actions; revalidate the project page on success.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/actions.ts`

- [ ] **Task ID:** AI-P2-05
  **Title:** "Insight" tab in `node-drawer` (read-only)
  **Description:** Add a new tab `insight` between `info` and `decisions` in `node-drawer.tsx`. Visible only when `node.type === 'feature'`. Renders the list of code-links grouped by `artifactType`. Empty state with a "Add code link" CTA.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-04
  **Acceptance Criteria:** tab appears only for feature nodes; populated and empty states render correctly; i18n keys added under `dict.codeflow.drawer.tabInsight`.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`, `apps/web-app/src/lib/i18n/en.ts`, `apps/web-app/src/lib/i18n/it.ts`

- [ ] **Task ID:** AI-P2-06
  **Title:** Manual code-link creation form
  **Description:** Add a form in the Insight tab to create a manual link: artifact type select, artifact path, optional symbol, optional line range. Validates non-empty path; shows pending/error states.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-05
  **Acceptance Criteria:** create + delete round-trip in browser; persisted with `source='manual'`; error path renders an inline message.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`

- [ ] **Task ID:** AI-P2-07
  **Title:** Playwright e2e — manual linking flow
  **Description:** End-to-end test that creates a feature node, opens the drawer, adds a manual code-link, asserts it appears in the list, deletes it, asserts removal.
  **Phase:** Phase 2
  **Dependencies:** AI-P2-06
  **Acceptance Criteria:** test runs green in CI on the existing e2e job; covered for both populated and empty states.
  **Priority:** medium
  **Complexity:** M
  **Files:** `apps/web-app/e2e/` (existing folder convention)

---

### Phase 3 — Atlas Insight Suggestions (MCP Integration)

- [ ] **Task ID:** AI-P3-01
  **Title:** ADR — Atlas Insight MCP transport (stdio vs StreamableHTTP)
  **Description:** Timeboxed spike. Run `codebase_status` and `codebase_search` from a Nest service against a local instance via stdio and via HTTP. Pick one. Document via `create_decision`.
  **Phase:** Phase 3
  **Dependencies:** —
  **Acceptance Criteria:** decision recorded in Roadboard with `impactLevel='medium'`; ADR file under `docs/design/`.
  **Priority:** high
  **Complexity:** S
  **Files:** `docs/design/`

- [ ] **Task ID:** AI-P3-02
  **Title:** `CodeContextModule` skeleton
  **Description:** New Nest module under `apps/core-api/src/modules/code-context/`. Wires `CodeContextClient`, `InsightService`, `FeatureLinkerService`, and a `FeatureLinkerController`. Reads env: `ATLAS_INSIGHT_URL`, `ATLAS_INSIGHT_TOKEN`, `ATLAS_INSIGHT_TIMEOUT_MS`.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-01
  **Acceptance Criteria:** module loads in app bootstrap; healthcheck `GET /projects/:id/codeflow/insight/health` returns `{ ok: false, reason: 'unconfigured' }` when env is unset.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/code-context/code-context.module.ts`, `apps/core-api/src/modules/code-context/insight.service.ts`, `apps/core-api/src/modules/code-context/feature-linker.service.ts`, `apps/core-api/src/modules/code-context/feature-linker.controller.ts`, `apps/core-api/src/app.module.ts`, `.env.example`

- [ ] **Task ID:** AI-P3-03
  **Title:** `CodeContextClient` — MCP wrapper with circuit breaker
  **Description:** Thin client around `@modelcontextprotocol/sdk` (StreamableHTTP). Implements timeout, single retry, and a circuit breaker (5 failures → open 30s). Exposes typed methods: `status()`, `search()`, `context()`, `graphQuery()`.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-02
  **Acceptance Criteria:** unit specs cover happy, timeout, retry, breaker-open paths; logs go through `@roadboard/observability`.
  **Priority:** high
  **Complexity:** L
  **Files:** `apps/core-api/src/modules/code-context/code-context.client.ts`, `apps/core-api/src/modules/code-context/code-context.client.spec.ts`

- [ ] **Task ID:** AI-P3-04
  **Title:** Project ↔ Atlas Insight project mapping
  **Description:** Persist `socraticodeProjectId` (kept generic on disk; user-facing label "Atlas Insight project") inside `CodeRepository.metadata`. Settings UI on the Atlas tab to edit it. Until set, `InsightService` short-circuits.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-02
  **Acceptance Criteria:** value editable by `CODEFLOW_WRITE` only; audit log entry on change; "Atlas Insight unconfigured" banner when missing.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/codeflow/codeflow.service.ts`, `apps/core-api/src/modules/codeflow/repositories.controller.ts`, `apps/core-api/src/modules/codeflow/dto/update-repository.dto.ts`, `apps/web-app/src/app/projects/[id]/codeflow/`

- [ ] **Task ID:** AI-P3-05
  **Title:** `InsightService.status()` proxy
  **Description:** Endpoint `GET /projects/:id/codeflow/insight/health` calls `codebase_status` through `CodeContextClient` and returns shape `{ ok, indexedAt, fileCount, commitHash }`.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-03, AI-P3-04
  **Acceptance Criteria:** returns 200 with status payload when configured + reachable; returns 503 with reason on adapter error; covered by spec.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/core-api/src/modules/code-context/insight.service.ts`, `apps/core-api/src/modules/code-context/feature-linker.controller.ts`

- [ ] **Task ID:** AI-P3-06
  **Title:** `FeatureLinkerService.suggest(nodeId)`
  **Description:** Builds the search query from `node.name + node.description + node.domainGroup`, calls `InsightService.search`, maps top-K hits into a suggestion DTO with `confidence` and `artifactType`. No persistence.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-05
  **Acceptance Criteria:** returns 5–10 ranked suggestions in ≤2s p95 on a seeded project; deterministic ordering; covered by spec with mocked client.
  **Priority:** high
  **Complexity:** L
  **Files:** `apps/core-api/src/modules/code-context/feature-linker.service.ts`, `apps/core-api/src/modules/code-context/feature-linker.service.spec.ts`

- [ ] **Task ID:** AI-P3-07
  **Title:** REST endpoint — `POST /codeflow/insight/suggestions`
  **Description:** Controller route accepting `{ nodeId }` and returning the suggestion list. `CODEFLOW_READ` grant.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-06
  **Acceptance Criteria:** Nest e2e covers happy, unconfigured, breaker-open paths; response shape stable across statuses.
  **Priority:** high
  **Complexity:** S
  **Files:** `apps/core-api/src/modules/code-context/feature-linker.controller.ts`

- [ ] **Task ID:** AI-P3-08
  **Title:** Accept-suggestion endpoint with persistence
  **Description:** `POST /codeflow/insight/links` accepts a suggestion and creates a `feature_code_links` row with `source='mcp'` and persisted `confidence`. Idempotent on `(nodeId, artifactType, artifactPath, artifactSymbol)`.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-07, AI-P1-06
  **Acceptance Criteria:** double-accept returns 200 without duplicate; persisted row passes `feature_code_links` integrity checks.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/code-context/feature-linker.service.ts`, `apps/core-api/src/modules/codeflow/feature-code-links.service.ts`

- [ ] **Task ID:** AI-P3-09
  **Title:** Web-app — "Suggest code links" UI flow
  **Description:** Button in the Insight tab triggers a fetch to suggestions; renders pending list with ✓/✗ buttons; ✓ persists, ✗ dismisses (client-side memory only for now). Skeleton loading state and adapter-error banner.
  **Phase:** Phase 3
  **Dependencies:** AI-P3-07, AI-P3-08, AI-P2-06
  **Acceptance Criteria:** Playwright e2e covers happy + reject + adapter-error; respects `prefers-reduced-motion`.
  **Priority:** high
  **Complexity:** L
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`, `apps/web-app/src/app/projects/[id]/codeflow/actions.ts`, `apps/web-app/src/lib/api.ts`

- [ ] **Task ID:** AI-P3-10
  **Title:** Source + confidence badges on links
  **Description:** Badge next to each link: `manual` (white), `mcp` (indigo), `inferred` (teal); confidence color-coded (≥0.85 green, 0.6–0.85 amber, <0.6 grey).
  **Phase:** Phase 3
  **Dependencies:** AI-P3-09
  **Acceptance Criteria:** all four states visible in dark and light themes; visual snapshot test green.
  **Priority:** medium
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`

---

### Phase 4 — Impact Analysis Fusion

- [ ] **Task ID:** AI-P4-01
  **Title:** `InsightService.graphQuery()` integration
  **Description:** Wire `codebase_graph_query` through `CodeContextClient`. Returns callers/callees + impacted tests for an artifact path.
  **Phase:** Phase 4
  **Dependencies:** AI-P3-03
  **Acceptance Criteria:** unit spec mocks the MCP response and asserts mapping into a stable DTO.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/code-context/insight.service.ts`

- [ ] **Task ID:** AI-P4-02
  **Title:** `FeatureLinkerService.impact(nodeId)` — fusion logic
  **Description:** For a feature node, gather its `feature_code_links`, query `InsightService.graphQuery` per artifact, merge with existing `ImpactAnalysis` for the same project, deduplicate by file path, attach provenance (`atlas` / `insight`).
  **Phase:** Phase 4
  **Dependencies:** AI-P4-01, AI-P1-07
  **Acceptance Criteria:** spec proves dedup + provenance; performance ≤1.5s p95 on seeded project; degrades gracefully when Insight is down (returns Atlas-only result).
  **Priority:** high
  **Complexity:** L
  **Files:** `apps/core-api/src/modules/code-context/feature-linker.service.ts`, `apps/core-api/src/modules/codeflow/graph.service.ts`

- [ ] **Task ID:** AI-P4-03
  **Title:** REST endpoint — `GET /codeflow/insight/impact?nodeId=...`
  **Description:** Read-only endpoint exposing the fused impact result. `CODEFLOW_READ`.
  **Phase:** Phase 4
  **Dependencies:** AI-P4-02
  **Acceptance Criteria:** Nest e2e covers happy + Insight-down + node-not-found; response schema documented.
  **Priority:** medium
  **Complexity:** S
  **Files:** `apps/core-api/src/modules/code-context/feature-linker.controller.ts`

---

### Phase 5 — UI Enrichment (Insight Tab + Overlays)

- [ ] **Task ID:** AI-P5-01
  **Title:** Atlas header — Insight status banner
  **Description:** Above the canvas: "Atlas Insight indexed at HH:MM · N files · branch X" or "Atlas Insight unavailable". Calls `/insight/health`.
  **Phase:** Phase 5
  **Dependencies:** AI-P3-05
  **Acceptance Criteria:** banner state matches health endpoint; auto-refresh every 60s; localized in en + it.
  **Priority:** medium
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/architecture-map-view.tsx`, `apps/web-app/src/lib/i18n/{en,it}.ts`

- [ ] **Task ID:** AI-P5-02
  **Title:** Insight tab — impact view
  **Description:** New section in the Insight tab calling `/codeflow/insight/impact?nodeId=...`. Lists affected files/tests with provenance per item. "Re-run" button.
  **Phase:** Phase 5
  **Dependencies:** AI-P4-03
  **Acceptance Criteria:** Playwright e2e covers populated + empty + error states.
  **Priority:** medium
  **Complexity:** M
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`

- [ ] **Task ID:** AI-P5-03
  **Title:** Canvas overlay — technical dependencies toggle
  **Description:** Toggle in canvas header. When on, overlays edges from impact/graph results as dashed lines distinct from native Atlas edges.
  **Phase:** Phase 5
  **Dependencies:** AI-P5-02
  **Acceptance Criteria:** toggle on a 200-node project keeps FPS ≥30; visually distinguishable in dark and light themes.
  **Priority:** medium
  **Complexity:** L
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/architecture-map-canvas.tsx`

- [ ] **Task ID:** AI-P5-04
  **Title:** Stale-link visual indicator
  **Description:** Red dot + tooltip "Artifact missing at HEAD (last seen YYYY-MM-DD)" for links with `status='stale'`.
  **Phase:** Phase 5
  **Dependencies:** AI-P2-06
  **Acceptance Criteria:** indicator visible only for stale links; covered by visual snapshot.
  **Priority:** low
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`

---

### Phase 6 — Automation and Verification

- [ ] **Task ID:** AI-P6-01
  **Title:** Worker job — stale-link verifier
  **Description:** BullMQ job in `apps/worker-jobs` that scans `feature_code_links` older than N hours, checks each `artifactPath` exists at HEAD via `InsightService.context()` (or local file probe), updates `status` and `lastVerifiedAt`. Schedule: hourly.
  **Phase:** Phase 6
  **Dependencies:** AI-P3-03, AI-P1-06
  **Acceptance Criteria:** stale links flagged within 24h of file removal in a controlled test repo; job metrics exposed in observability.
  **Priority:** high
  **Complexity:** M
  **Files:** `apps/worker-jobs/src/`, `apps/core-api/src/modules/codeflow/feature-code-links.service.ts`

- [ ] **Task ID:** AI-P6-02
  **Title:** Auto-suggestion on feature creation
  **Description:** On `node.create` with `type='feature'`, enqueue a job that pre-computes suggestions and stores them as pending (new column `pending_suggestions Json` or sibling table). UI surfaces a non-blocking toast.
  **Phase:** Phase 6
  **Dependencies:** AI-P3-09
  **Acceptance Criteria:** new feature node receives suggestions within 1 minute on the demo seed project; toast dismissable.
  **Priority:** medium
  **Complexity:** L
  **Files:** `apps/worker-jobs/src/`, `apps/core-api/src/modules/codeflow/graph.service.ts`, `apps/web-app/src/app/projects/[id]/codeflow/`

- [ ] **Task ID:** AI-P6-03
  **Title:** Re-verification admin action
  **Description:** Add an admin-only button "Re-verify all code-links" that enqueues the verifier job for the entire project. Audit-logged.
  **Phase:** Phase 6
  **Dependencies:** AI-P6-01
  **Acceptance Criteria:** action visible only with admin grant; produces an audit row; UI shows toast on enqueue.
  **Priority:** low
  **Complexity:** S
  **Files:** `apps/web-app/src/app/projects/[id]/codeflow/`, `apps/core-api/src/modules/codeflow/graph.controller.ts`

- [ ] **Task ID:** AI-P6-04
  **Title:** Optional CI hook — re-index notification
  **Description:** Webhook endpoint that receives a "merged-to-main" event from CI and triggers Atlas Insight re-index + verifier. Off by default; documented in `docs/`.
  **Phase:** Phase 6
  **Dependencies:** AI-P6-01
  **Acceptance Criteria:** signed-payload validation; idempotent on duplicate events; documented in `docs/atlas-insight.md`.
  **Priority:** low
  **Complexity:** M
  **Files:** `apps/core-api/src/modules/code-context/`, `docs/atlas-insight.md`

---

### Execution Strategy

**Recommended order of execution:**
Linearly Phase 0 → Phase 6. Within each phase, follow task ID order: tasks are ordered by intra-phase dependency. Inside Phase 1, AI-P1-04 (migration) and AI-P1-02 (validator) can run in parallel after AI-P1-01. Inside Phase 2, AI-P2-01..04 are a vertical slice; only after that do AI-P2-05..07 run. Phase 3 must not start before Phase 2's e2e (AI-P2-07) is green.

**Validation gate before moving to the next phase:**
- After Phase 0: 7 consecutive zero-drift days + outbox backlog stable.
- After Phase 1: clean migration on staging + Memgraph schema applied + drift still zero.
- After Phase 2: manual link creation/deletion e2e green; no regression in existing CodeFlow tests.
- After Phase 3: suggestions endpoint p95 ≤2s on seeded data; circuit breaker observed in adapter-down test; at least one feature node in production data has accepted MCP-sourced links.
- After Phase 4: impact endpoint returns merged + deduplicated results within 1.5s p95; degrades cleanly when Insight is unavailable.
- After Phase 5: ≥2 weeks of real usage with positive UX feedback before automation work.
- After Phase 6: stale verifier produces ≤1% false positive rate over 7 days.

**Risks to monitor:**
- Outbox backlog growth when `feature_code_links` writes spike (mitigation: monitor in Phase 0/1).
- Atlas Insight latency dragging down the Atlas tab render (mitigation: all calls async, Atlas page never blocks on Insight).
- Suggestion noise (low-confidence false positives eroding trust) — track accept/reject ratio from Phase 3 onward; tune top-K and thresholds.
- Memgraph drift introduced by the new `:CodeArtifact` label — extend drift checks in Phase 1.
- Path canonicalization across mono- vs multi-repo setups (`repoRef` + `artifactPath` discipline).
- Worker-job throughput once verifier and auto-suggester run together (mitigation: rate-limit, separate queues).
