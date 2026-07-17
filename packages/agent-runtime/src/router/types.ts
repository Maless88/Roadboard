import type { DegradePolicy, LlmCapabilities, LlmModelDescriptor } from '../capability/contract';
import type { RegisteredProvider } from '../registry/types';


export type BudgetKind = 'premiumCalls' | 'toolCalls' | 'filesTouched' | 'inputTokens' | 'outputTokens';


export interface RouterCandidate {
  readonly provider: RegisteredProvider;
  readonly model: LlmModelDescriptor;
}


export interface ResolveOptions {
  /** Applied only when candidates exist but none passes the hard filters. Defaults to `'fail'`. */
  degradePolicy?: DegradePolicy;
  /** Capability flags treated as droppable under the `skip` policy. `vision` is the canonical example. */
  optionalCapabilities?: readonly (keyof LlmCapabilities)[];
}


export interface RouterResolution {
  readonly provider: RegisteredProvider;
  readonly model: LlmModelDescriptor;
  readonly degraded: boolean;
  readonly needsConfirmation?: boolean;
  readonly unmet: readonly string[];
  readonly fallbacks: readonly RouterCandidate[];
  readonly reason: string;
}


export class RouterError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'RouterError';
  }
}


export class RouterBudgetError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'RouterBudgetError';
  }
}
