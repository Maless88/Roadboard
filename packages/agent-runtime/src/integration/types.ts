import type { AgentRole, TaskRequirements } from '../capability/contract';
import type { ChatMessage } from '../providers/types';
import type { ResolveOptions, RouterResolution } from '../router/types';


/** A single already-retrieved context snippet. `buildContextPack` does not fetch these. */
export interface RetrievedSnippet {
  content: string;
  source?: string;
}


/** Structured, pre-retrieved inputs from which a compact prompt payload is assembled. */
export interface ContextPackInput {
  systemPrompt?: string;
  priorMessages?: readonly ChatMessage[];
  snippets?: readonly RetrievedSnippet[];
}


export interface ContextPackOptions {
  /** Approximate token budget for the whole pack. Conservative default when omitted. */
  maxTokens?: number;
}


/** Compact prompt payload plus accounting of the budget spend and what was dropped. */
export interface ContextPack {
  messages: ChatMessage[];
  /** Approximate token spend of the whole pack. Never exceeds the requested budget. */
  approxTokens: number;
  /** Number of prior messages dropped to fit the budget. */
  dropped: number;
  /** True when the system message itself had to be hard-clamped to the budget. */
  truncated: boolean;
}


/** Per-role requirement overrides — the `role` itself is fixed by the caller, never overridden. */
export type RequirementOverrides = Partial<Omit<TaskRequirements, 'role'>>;


export interface PlanAgentTurnOptions {
  overrides?: RequirementOverrides;
  context?: ContextPackInput;
  contextOptions?: ContextPackOptions;
  resolveOptions?: ResolveOptions;
}


/**
 * Result of planning one agent turn. Discriminated on `ok`:
 * - `ok: true` — a concrete `(provider, model)` was resolved (possibly `resolution.degraded`).
 * - `ok: false` — the registry has zero enumerable candidates; the pack and requirements are
 *   still populated so the caller can report a coherent degrade state.
 */
export type AgentTurnPlan =
  | {
      ok: true;
      resolution: RouterResolution;
      contextPack: ContextPack;
      requirements: TaskRequirements;
    }
  | {
      ok: false;
      reason: 'no-candidates';
      contextPack: ContextPack;
      requirements: TaskRequirements;
      detail: string;
    };


export type { AgentRole };
