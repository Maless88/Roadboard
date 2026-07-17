import type { CostClass, LatencyClass, PrivacyClass } from '../capability/contract';

/**
 * Explicit `string → index` order maps for the three ordered capability classes. Per
 * docs/adr/0002-llm-runtime-capability-contract.md "Watch" note, these are the single source
 * of truth for "which class is stricter" and must never be re-derived from a union's
 * declaration order (e.g. `Object.keys` on a type, or array index of a TS union).
 */

/** Canonical order: local < private-cloud < public-cloud. */
export const PRIVACY_CLASS_ORDER: readonly PrivacyClass[] = ['local', 'private-cloud', 'public-cloud'];

/** Canonical order: free < low < medium < high. */
export const COST_CLASS_ORDER: readonly CostClass[] = ['free', 'low', 'medium', 'high'];

/** Canonical order: realtime < interactive < batch. */
export const LATENCY_CLASS_ORDER: readonly LatencyClass[] = ['realtime', 'interactive', 'batch'];

const PRIVACY_RANK: Readonly<Record<PrivacyClass, number>> = {
  local: 0,
  'private-cloud': 1,
  'public-cloud': 2,
};

const COST_RANK: Readonly<Record<CostClass, number>> = {
  free: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const LATENCY_RANK: Readonly<Record<LatencyClass, number>> = {
  realtime: 0,
  interactive: 1,
  batch: 2,
};


export function privacyRank(value: PrivacyClass): number {
  return PRIVACY_RANK[value];
}


export function costRank(value: CostClass): number {
  return COST_RANK[value];
}


export function latencyRank(value: LatencyClass): number {
  return LATENCY_RANK[value];
}


/** True when `value`'s ordinal is at or below `max`'s ordinal — i.e. within the ceiling. */
export function withinPrivacyCeiling(value: PrivacyClass, max: PrivacyClass): boolean {
  return privacyRank(value) <= privacyRank(max);
}


export function withinCostCeiling(value: CostClass, max: CostClass): boolean {
  return costRank(value) <= costRank(max);
}


export function withinLatencyCeiling(value: LatencyClass, max: LatencyClass): boolean {
  return latencyRank(value) <= latencyRank(max);
}


/** `max(0, rank(value) - rank(max))` — 0 when within the ceiling, positive overage otherwise. */
export function privacyOverage(value: PrivacyClass, max: PrivacyClass): number {
  return Math.max(0, privacyRank(value) - privacyRank(max));
}


export function costOverage(value: CostClass, max: CostClass): number {
  return Math.max(0, costRank(value) - costRank(max));
}


export function latencyOverage(value: LatencyClass, max: LatencyClass): number {
  return Math.max(0, latencyRank(value) - latencyRank(max));
}
