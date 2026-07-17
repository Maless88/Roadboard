# LLM Runtime — Configuration & Behavior

`packages/agent-runtime` detects which LLM providers are configured from environment
variables, builds a metadata-only registry, and routes tasks to a concrete
`(provider, model)` pick against declared capabilities. This document describes the
operator-facing configuration surface and the runtime's degradation behavior.

For the capability contract rationale (why the runtime is brand-neutral, the shape of
`LlmCapabilities`/`TaskRequirements`/`LlmProvider`), see
[`docs/adr/0002-llm-runtime-capability-contract.md`](adr/0002-llm-runtime-capability-contract.md).

## Configuration surface: environment variables only

The runtime reads configuration exclusively from environment variables via
`readRegistryEnvFromProcess()` (`packages/agent-runtime/src/registry/detection.ts`), which
wraps `@roadboard/config`'s `optionalEnv`. **There is no YAML (or any other file-based)
configuration path in the current code** — despite the term appearing in some planning
notes, it is not implemented. If a YAML config surface is added later, this document must
be updated alongside it.

| Variable | Enables | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | Registers the `anthropic` provider with the static `ANTHROPIC_MODEL_CATALOG`. |
| `OPENAI_API_KEY` | OpenAI | Registers the `openai` provider with the static `OPENAI_MODEL_CATALOG` — unless `OPENAI_BASE_URL` is also set (see precedence below). |
| `OPENAI_BASE_URL` | Enterprise / openai-compatible endpoint (e.g. Groq) | Any non-empty value registers the `enterprise` provider instead of `openai`. `OPENAI_API_KEY`, if present, is treated as the enterprise endpoint's key, not OpenAI's. |
| `OLLAMA_BASE_URL` | Local Ollama | Registers the `ollama` provider. Model listing is injected via `RegistryDeps.listOllamaModels` (a real network call to `/api/tags` at the runtime boundary) — the registry itself never dials out. |
| `GEMINI_API_KEY` | Google Gemini | Registers the `gemini` provider. There is no static Gemini catalog; models come from `RegistryDeps.listGeminiModels` or are empty by default. |

## Env combinations → `RuntimeProfile`

`detectConfig(env)` turns the env snapshot into a `DetectedConfig`, and
`classifyProfile(detected)` turns that into one of five `RuntimeProfile` values. This
table is the same matrix exercised end-to-end by
`packages/agent-runtime/src/registry/runtime-matrix.spec.ts` — keep the two in sync; a
change to detection/classification must update both.

| Configuration | Env | `RuntimeProfile` | Registered providers |
|---|---|---|---|
| Only Ollama | `OLLAMA_BASE_URL` | `local-only` | `ollama` |
| Only OpenAI | `OPENAI_API_KEY` | `single-provider` | `openai` |
| Only Anthropic | `ANTHROPIC_API_KEY` | `single-provider` | `anthropic` |
| Only Gemini | `GEMINI_API_KEY` | `single-provider` | `gemini` |
| Groq / openai-compatible | `OPENAI_BASE_URL` + `OPENAI_API_KEY` | `enterprise` | `enterprise` (the `openai` slot is suppressed) |
| Multi-provider | ≥2 of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OLLAMA_BASE_URL` / `GEMINI_API_KEY`, no `OPENAI_BASE_URL` | `multi-provider` | all detected brands |
| No LLM configured | (empty) | `offline-limited` | none |

### `OPENAI_BASE_URL` precedence

A non-empty `OPENAI_BASE_URL` always wins, regardless of how many other providers are
also configured — `classifyProfile` checks `detected.enterprise` first, before counting
any other detected provider. The reasoning (`buildRegistry`,
`packages/agent-runtime/src/registry/provider-registry.ts`): a custom openai-compatible
endpoint changes the *operational* model (it is operator-controlled infrastructure, not
the branded public OpenAI API), so registering both `enterprise` and `openai` for the
same `OPENAI_API_KEY` would wrongly expose OpenAI's static model catalog and
`public-cloud` privacy class for a deployment that may not even be OpenAI (e.g. Groq).
The `enterprise` provider is classified with `privacyClass: 'private-cloud'` and has no
reliable static catalog — its models are empty unless `RegistryDeps.listEnterpriseModels`
is supplied.

## Capability model, in brief

Every registered provider carries a `privacyClass` (`local` < `private-cloud` <
`public-cloud`); every model carries `costClass` (`free` < `low` < `medium` < `high`),
`latencyClass` (`realtime` < `interactive` < `batch`), and an `LlmCapabilities` flag set
(`toolUse`, `structuredOutput`, `vision`, `streaming`, `longContext`,
`contextWindowTokens`).

A caller expresses a `TaskRequirements` object: a `role`, a list of
`requiredCapabilities` (boolean flags only — `contextWindowTokens` is numeric and is
never treated as a pass/fail flag), and three ceilings (`maxPrivacyClass`,
`maxCostClass`, `maxLatencyClass`) — a candidate must be *at or below* each ceiling in
the ordinal order above to pass.

## `CapabilityRouter` and `DegradePolicy`

`CapabilityRouter.resolve(requirements, registry, opts)`
(`packages/agent-runtime/src/router/capability-router.ts`) picks a concrete
`(provider, model)` for a `TaskRequirements` against a `BuiltRegistry`:

1. If the registry has **zero enumerable candidates** (no providers, or providers with
   no models at all — e.g. `offline-limited`, or a configured provider whose model list
   is empty), `resolve()` **throws `RouterError` immediately, before any `DegradePolicy`
   is applied** — this is true under all four policies.
2. Otherwise, candidates are filtered by the hard filters (capability flags + the three
   ceilings). If at least one candidate passes, the cheapest/fastest/most-private
   passing candidate is returned with `degraded: false`.
3. If no candidate passes the hard filters, `opts.degradePolicy` (default `'fail'`)
   decides what happens next:
   - `fail` — throws `RouterError` naming the closest candidate and what it fails.
   - `degrade` — returns the minimum-distance candidate with `degraded: true` and
     `unmet` listing the lacked capabilities/ceilings, without throwing.
   - `ask` — same as `degrade`, plus `needsConfirmation: true`, without throwing.
   - `skip` — drops the capabilities listed in `opts.optionalCapabilities` and retries
     the hard filter; if that resolves it, returns normally (`degraded: false`);
     otherwise falls through to the same behavior as `fail`.

## No-provider / local-only degradation

`buildRuntimeDiagnostics(registry, detected)`
(`packages/agent-runtime/src/diagnostics/diagnostics.ts`) reports what is and isn't
available without ever throwing:

- **`offline-limited`** (no provider configured): a single `degradedFeatures` entry,
  `{ feature: 'llm-turns', reason: 'no provider configured' }`. No LLM-backed turn can
  run, but the rest of RoadBoard (tasks, phases, memory, decisions, non-LLM tooling)
  is unaffected — a missing provider never breaks RoadBoard, it only disables LLM turns.
- **A configured provider with zero models** (e.g. `enterprise`/`gemini` without an
  injected model list): the same `llm-turns` feature degrades, with a reason naming how
  many providers are configured but that 0 models are available — distinct wording from
  the `offline-limited` case.
- **Missing `vision` / `toolUse` across the model union**: if no registered model across
  all registered providers declares `vision` (or `toolUse`), a corresponding
  `degradedFeatures` entry is added (`{ feature: 'vision', ... }` /
  `{ feature: 'toolUse', ... }`), even when other providers/models are otherwise healthy.
- **No local provider**: if no registered provider has `privacyClass: 'local'`, a
  `local-privacy` degradation is reported — this is the expected case for any
  configuration without Ollama (only-OpenAI, only-Anthropic, only-Gemini,
  multi-provider without Ollama, enterprise).

In every case, diagnostics degrade gracefully rather than throwing — only
`CapabilityRouter.resolve()` under `fail`/zero-candidates throws, and only when an
actual task is being routed, not when merely inspecting runtime state.
