# ADR-0002 — LLM Runtime: Capability Contract

**Status**: Proposed
**Date**: 2026-07-16
**Author**: Worker (AI)
**RoadBoard Task**: `cmr0mlgus0181ln017aeansm9`
**Phase**: Backlog (`cmr0mlgr6017xln01096ko02j`)

---

## Context

RoadBoard's agent runtime (`packages/agent-runtime`) currently hard-codes three chat
providers (`openai`, `anthropic`, `ollama`) behind a small `ChatProvider` interface
(`providers/types.ts`, `providers/index.ts`) and an `AgentExecutor` that picks a provider
by name or proxies to a CLI bridge (`agent-executor.ts`, `AgentExecConfig.runtime:
'api'|'cli'|'local'`).

This is the capstone task of the LLM Runtime sprint (`PLAN.md`, section _LLM Runtime_,
8 tasks). The 7 sibling tasks build, in order: a provider registry + auto-detection, an
openai-compatible adapter, a native Ollama adapter, native adapters for the
Anthropic/OpenAI/Gemini APIs, a `CapabilityRouter` that picks a provider per task, runtime
diagnostics, agent integration, and a cross-provider test matrix. None of that exists yet;
no ADR or RoadBoard decision covers this area. This document is the first record and
defines the **contract** the sibling tasks implement against — it does not implement any
of the above itself.

### Cardinal constraint

**RoadBoard must not depend on any LLM brand.** Claude, OpenAI, and Gemini are providers
that *declare capabilities*; none of them is a special case in the core runtime. Any code
path that branches on a brand name outside of a provider adapter is a contract violation.

---

## Decision

Introduce a brand-neutral **capability contract** — a type-only module,
`packages/agent-runtime/src/capability/contract.ts`, re-exported from the package's
public surface. It defines the vocabulary every provider adapter, the registry, and the
`CapabilityRouter` (sibling tasks) will share. No runtime logic lives here: no adapter, no
router, no detection code. This ADR fixes the shape of that vocabulary.

### `AgentRole`

The role an agentic turn is running as, independent of which model executes it:

```ts
type AgentRole =
  | 'intake'
  | 'router'
  | 'dev'
  | 'security'
  | 'researcher'
  | 'assistant';
```

`intake`/`router` typically tolerate a cheaper/faster model; `dev`/`security` typically
need tool-use and larger context; `researcher` typically needs long context and possibly
vision; `assistant` is the general conversational fallback. The router (sibling task)
owns the actual role→requirement mapping; this contract only names the roles.

### `PrivacyClass`, `CostClass`, `LatencyClass` — ordered string unions

```ts
type PrivacyClass = 'local' | 'private-cloud' | 'public-cloud';
type CostClass = 'free' | 'low' | 'medium' | 'high';
type LatencyClass = 'realtime' | 'interactive' | 'batch';
```

Each is an **ordinable** union of string literals, with the canonical order given above,
left-to-right, most-restrictive/cheapest/fastest first:

- `PrivacyClass`: `local` (no data leaves the host) `<` `private-cloud` (contractual /
  VPC-isolated provider) `<` `public-cloud` (shared multi-tenant API). A task's maximum
  tolerated privacy class must be `>=` the provider's class in this order (a task that
  tolerates only `local` cannot be routed to a `public-cloud` provider).
- `CostClass`: `free` `<` `low` `<` `medium` `<` `high`, a coarse per-call cost bucket
  (not a currency amount — normalizing $/token across brands is a router concern).
- `LatencyClass`: `realtime` `<` `interactive` `<` `batch`, coarse expected
  time-to-first-token / time-to-completion bucket.

These are plain string-literal unions, not TypeScript `enum`s (rationale below). The
ordinal comparison itself (a string→index map, `<=` semantics) is **not** defined here —
it is the responsibility of the sibling `CapabilityRouter` task. This ADR fixes only the
type and the canonical order.

### `LlmCapabilities`

What a given model/provider combination can actually do:

```ts
interface LlmCapabilities {
  toolUse: boolean;
  structuredOutput: boolean;
  vision: boolean;
  streaming: boolean;
  longContext: boolean;
  contextWindowTokens: number;
}
```

`longContext` is a coarse boolean flag (router-level filtering); `contextWindowTokens` is
the precise figure for budget arithmetic.

### `LlmProvider`

Brand-neutral provider abstraction — a **superset-compatible** replacement for today's
`ChatProvider`:

```ts
interface LlmModelDescriptor {
  id: string;
  capabilities: LlmCapabilities;
  costClass: CostClass;
  latencyClass: LatencyClass;
}

interface LlmProvider {
  readonly id: string;
  readonly privacyClass: PrivacyClass;
  readonly models: readonly LlmModelDescriptor[];

  complete(request: LlmRequest, config: ChatProviderConfig): Promise<LlmResponse>;
  stream(request: LlmRequest, config: ChatProviderConfig): AsyncIterable<string>;
  ping(config: ChatProviderConfig): Promise<void>;
}
```

`LlmProvider` reuses `ChatProviderConfig` (`providers/types.ts`) verbatim for per-call
connection data — no new config shape is introduced.

Mapping from the existing surface:

- `ChatProvider.name: 'openai' | 'anthropic' | 'ollama'` → `LlmProvider.id: string`. The
  contract widens the brand-closed union to an open `string` so a provider registry
  (sibling task) can register openai-compatible / self-hosted providers without touching
  this file.
- `ProviderName` (`providers/index.ts`) becomes a runtime-registered value, not a
  compile-time union — the registry (sibling task) is the source of truth for which
  provider ids exist at runtime.
- `ChatProviderConfig` (`apiKey?`, `baseUrl?`, `model`) is reused as-is by
  `LlmProvider.complete()` / `.stream()` / `.ping()` — this ADR does not change
  `ChatProviderConfig`.
- `ChatProvider.stream(messages, config)` → `LlmProvider.stream(request, config)`: the
  same transport-level method, generalized from a raw `ChatMessage[]` to the normalized
  `LlmRequest` envelope (which carries `messages` plus optional `tools` /
  `maxOutputTokens`) so tool-use and structured-output declarations travel with the
  request instead of being bolted on separately. `ChatProvider.ping(config)` maps to
  `LlmProvider.ping(config)` unchanged. `LlmProvider` additionally requires
  `complete()` — a non-streaming call returning a full `LlmResponse` (content + `usage` +
  `finishReason`) — which `ChatProvider` has no equivalent for today; a concrete adapter
  that only ever streamed can implement `complete()` by draining `stream()` and
  accumulating usage. `LlmProvider` is therefore a **structural superset** of
  `ChatProvider`: every `ChatProvider` capability (identify, stream, ping) has a
  same-purpose `LlmProvider` member, plus the declarative capability surface (`models`,
  `privacyClass`) and the non-streaming `complete()` that `ChatProvider` lacked. A
  sibling task will make concrete adapters implement `LlmProvider` (and may keep
  `ChatProvider` as a thin transitional wrapper during migration).
- `AgentExecConfig.runtime: 'api' | 'cli' | 'local'` (`agent-executor.ts`) is unaffected:
  it selects *how* a turn is executed (direct API call vs. CLI bridge vs. embedded local
  model), which is orthogonal to *which* provider capabilities are available. No change
  to `AgentExecConfig` is made or required by this contract.

**No behavioral change**: this ADR and its contract file are purely additive. Existing
`ChatProvider`/`ProviderName`/`ChatProviderConfig`/`AgentExecConfig` code paths are
untouched; migration to the new contract happens incrementally in the sibling tasks.

### `LlmRequest` / `LlmResponse`

Normalized I/O, independent of any provider's wire format:

```ts
interface LlmToolDefinition {
  name: string;
  description: string;
  parametersSchema: unknown;
}

interface LlmRequest {
  messages: ChatMessage[];
  tools?: readonly LlmToolDefinition[];
  maxOutputTokens?: number;
}

interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

interface LlmResponse {
  content: string;
  usage: LlmUsage;
  finishReason: 'stop' | 'tool_call' | 'length' | 'error';
}
```

`LlmRequest` reuses the existing `ChatMessage` shape (`providers/types.ts`) rather than
redefining it — there is no reason to diverge on message shape. `LlmUsage` mirrors the
existing `AgentUsage` (`agent-executor.ts`: `in`/`out`/`cc`/`cr`) under clearer field
names; reconciling the two (or deprecating one) is left to the sibling agent-integration
task, not this contract.

### `TaskRequirements`

What a caller (router, sibling task) demands of a turn before picking a provider:

```ts
interface TaskRequirements {
  role: AgentRole;
  requiredCapabilities: readonly (keyof LlmCapabilities)[];
  maxPrivacyClass: PrivacyClass;
  maxCostClass: CostClass;
  maxLatencyClass: LatencyClass;
  maxPremiumCalls?: number;
  maxToolCalls?: number;
  maxFilesTouched?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}
```

The `max*Class` fields are budget ceilings expressed in the ordered unions above; the
router resolves them against a provider's declared class using the canonical order. The
`max*Calls`/`maxFilesTouched`/`max*Tokens` fields are coarse execution budgets for a
single agentic turn, deliberately generic rather than role-specific: `maxPremiumCalls`
caps calls to costly providers, `maxToolCalls` and `maxFilesTouched` cap tool-use
side-effects, and `maxInputTokens`/`maxOutputTokens` cap the token spend of a single
`LlmRequest`/`LlmResponse` exchange (independent of `LlmCapabilities.contextWindowTokens`,
which describes what a model *can* hold, not what a task *may spend*).

### `DegradePolicy`

What to do when `TaskRequirements` exceeds every available provider's capabilities:

```ts
type DegradePolicy = 'degrade' | 'ask' | 'skip' | 'fail';
```

- `degrade` — proceed with the closest available provider even though it does not fully
  meet the requirement (e.g. no tool-use available, fall back to a tool-less turn).
- `ask` — pause and require explicit user/developer confirmation before proceeding with a
  degraded provider.
- `skip` — drop the unmet requirement silently and proceed (only safe for genuinely
  optional capabilities, e.g. `vision` on a text-only task).
- `fail` — refuse to execute the turn and surface an error to the caller.

The router (sibling task) is responsible for applying this policy; this contract only
fixes the vocabulary.

---

## Rationale

### Why type-only and erasable, not a real module?

The contract is consumed by every future adapter, the registry, and the router. Making it
type-only (`type`/`interface` declarations only, no `class`, no `const`, no `enum`, no
runtime import) guarantees:

- Zero coupling risk — a contract change can never accidentally pull in a runtime
  dependency (HTTP client, brand SDK) into a file every provider imports.
- Zero circular-import risk between the contract and concrete adapters.
- The contract disappears entirely at compile time (`import type` / type-only imports),
  so it costs nothing at runtime or in bundle size.

`enum` is explicitly forbidden even though TypeScript enums look attractive for the
ordered classes (`PrivacyClass`/`CostClass`/`LatencyClass`): a regular TypeScript `enum`
emits a runtime object into the compiled JavaScript, which would violate the "no runtime
value" invariant this contract exists to guarantee. String-literal unions with a
documented canonical order achieve the same ordinal-comparison capability without any
runtime footprint; the sibling `CapabilityRouter` task owns the actual `string → index`
comparison map.

### Why widen `ChatProvider.name` to `string` instead of extending the closed union?

A closed union (`'openai' | 'anthropic' | 'ollama'`) cannot express an openai-compatible
self-hosted endpoint or a newly onboarded brand without editing this contract file for
every new provider — which is exactly the brand-coupling this ADR forbids. An open
`string` id, validated against a runtime registry (sibling task), keeps the contract
stable while the set of providers grows.

---

## Consequences

### Positive

- Sibling tasks (registry, adapters, router, diagnostics, agent integration, test matrix)
  have a single, reviewed vocabulary to implement against instead of inventing their own.
- No brand name appears anywhere in this contract — adding a new provider brand never
  requires touching `contract.ts`.
- Zero behavioral change: `ChatProvider`/`AgentExecutor` continue to work unmodified.

### Negative / Watch

- Two parallel usage-tracking shapes now exist (`AgentUsage` vs `LlmUsage`) until a
  sibling task reconciles them — documented above, not fixed here.
- The ordinal comparison for `PrivacyClass`/`CostClass`/`LatencyClass` is only documented,
  not enforced by the type system (nothing stops a future edit from silently reordering
  the literals as they're written) — the sibling `CapabilityRouter` task must encode the
  order explicitly as a `string → index` map, not re-derive it from declaration order.

### Test stance

**No unit tests.** This is a type-only contract; there is no runtime behavior to
exercise. Verification is `tsc --noEmit` (typecheck) and `tsc` (build) succeeding for
`@roadboard/agent-runtime`, confirming the contract compiles and is erasable.

### Open questions (deferred to sibling tasks)

- Exact registry discovery mechanism (env-driven vs. config file) — provider
  registry/detection task.
- Whether `LlmProvider.models` is populated statically per adapter or fetched
  dynamically from the provider's API — adapter tasks.
- Reconciling `AgentUsage` and `LlmUsage` — agent-integration task.
