import type { TaskRequirements } from '../capability/contract';
import { RouterBudget } from './budget';
import { RouterBudgetError } from './types';

const baseRequirements: TaskRequirements = {
  role: 'dev',
  requiredCapabilities: [],
  maxPrivacyClass: 'public-cloud',
  maxCostClass: 'high',
  maxLatencyClass: 'batch',
};


describe('RouterBudget', () => {

  it('treats an unset ceiling as unbounded for canAfford/record/remaining', () => {
    const budget = new RouterBudget(baseRequirements);

    expect(budget.canAfford('premiumCalls', 1_000_000)).toBe(true);
    expect(() => budget.record('premiumCalls', 1_000_000)).not.toThrow();
    expect(budget.remaining('premiumCalls')).toBe(Infinity);
  });

  it('canAfford is a pure predicate that never throws', () => {
    const budget = new RouterBudget({ ...baseRequirements, maxToolCalls: 1 });

    expect(budget.canAfford('toolCalls', 1)).toBe(true);
    budget.record('toolCalls', 1);
    expect(budget.canAfford('toolCalls', 1)).toBe(false);
  });

  it('record throws RouterBudgetError when it would exceed the ceiling', () => {
    const budget = new RouterBudget({ ...baseRequirements, maxFilesTouched: 2 });

    budget.record('filesTouched', 2);
    expect(() => budget.record('filesTouched', 1)).toThrow(RouterBudgetError);
  });

  it('remaining reflects consumption against the ceiling for each BudgetKind', () => {
    const budget = new RouterBudget({
      ...baseRequirements,
      maxPremiumCalls: 3,
      maxToolCalls: 5,
      maxFilesTouched: 2,
      maxInputTokens: 1_000,
      maxOutputTokens: 500,
    });

    budget.record('premiumCalls', 1);
    budget.record('toolCalls', 2);
    budget.record('filesTouched', 1);
    budget.record('inputTokens', 400);
    budget.record('outputTokens', 100);

    expect(budget.remaining('premiumCalls')).toBe(2);
    expect(budget.remaining('toolCalls')).toBe(3);
    expect(budget.remaining('filesTouched')).toBe(1);
    expect(budget.remaining('inputTokens')).toBe(600);
    expect(budget.remaining('outputTokens')).toBe(400);
  });

  it('record exceeding ceiling for each BudgetKind throws and leaves state unchanged', () => {
    const budget = new RouterBudget({
      ...baseRequirements,
      maxPremiumCalls: 1,
      maxToolCalls: 1,
      maxFilesTouched: 1,
      maxInputTokens: 1,
      maxOutputTokens: 1,
    });

    expect(() => budget.record('premiumCalls', 2)).toThrow(RouterBudgetError);
    expect(() => budget.record('toolCalls', 2)).toThrow(RouterBudgetError);
    expect(() => budget.record('filesTouched', 2)).toThrow(RouterBudgetError);
    expect(() => budget.record('inputTokens', 2)).toThrow(RouterBudgetError);
    expect(() => budget.record('outputTokens', 2)).toThrow(RouterBudgetError);

    expect(budget.remaining('premiumCalls')).toBe(1);
    expect(budget.remaining('toolCalls')).toBe(1);
    expect(budget.remaining('filesTouched')).toBe(1);
    expect(budget.remaining('inputTokens')).toBe(1);
    expect(budget.remaining('outputTokens')).toBe(1);
  });
});
