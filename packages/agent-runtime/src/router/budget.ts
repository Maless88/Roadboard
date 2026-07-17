import type { TaskRequirements } from '../capability/contract';
import type { BudgetKind } from './types';
import { RouterBudgetError } from './types';

const CEILING_FIELD_BY_KIND: Readonly<Record<BudgetKind, keyof TaskRequirements>> = {
  premiumCalls: 'maxPremiumCalls',
  toolCalls: 'maxToolCalls',
  filesTouched: 'maxFilesTouched',
  inputTokens: 'maxInputTokens',
  outputTokens: 'maxOutputTokens',
};


/**
 * Per-turn, caller-owned, in-memory budget tracker seeded from the coarse `TaskRequirements`
 * ceilings. Pure bookkeeping — no persistence, no network. A ceiling left `undefined` on the
 * requirements is treated as unbounded.
 */

export class RouterBudget {
  private readonly ceilings: Readonly<Partial<Record<BudgetKind, number>>>;
  private readonly consumed: Record<BudgetKind, number> = {
    premiumCalls: 0,
    toolCalls: 0,
    filesTouched: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  constructor(requirements: TaskRequirements) {
    const ceilings: Partial<Record<BudgetKind, number>> = {};

    for (const kind of Object.keys(CEILING_FIELD_BY_KIND) as BudgetKind[]) {
      const value = requirements[CEILING_FIELD_BY_KIND[kind]];

      if (typeof value === 'number') ceilings[kind] = value;
    }
    this.ceilings = ceilings;
  }

  /** Pure predicate — never throws. */
  canAfford(kind: BudgetKind, amount: number): boolean {
    const ceiling = this.ceilings[kind];

    if (ceiling === undefined) return true;

    return this.consumed[kind] + amount <= ceiling;
  }

  /** Records consumption; throws `RouterBudgetError` if it would exceed the ceiling. */
  record(kind: BudgetKind, amount: number): void {

    if (!this.canAfford(kind, amount)) {
      throw new RouterBudgetError(
        `Budget exceeded for "${kind}": ${this.consumed[kind]} + ${amount} > ${this.ceilings[kind]}`,
      );
    }
    this.consumed[kind] += amount;
  }

  /** Remaining allowance for `kind`. `Infinity` when the corresponding ceiling is unset. */
  remaining(kind: BudgetKind): number {
    const ceiling = this.ceilings[kind];

    if (ceiling === undefined) return Infinity;

    return ceiling - this.consumed[kind];
  }
}
