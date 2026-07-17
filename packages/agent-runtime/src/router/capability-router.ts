import type { LlmCapabilities, TaskRequirements } from '../capability/contract';
import type { BuiltRegistry } from '../registry/types';
import {
  costOverage,
  costRank,
  latencyOverage,
  latencyRank,
  privacyOverage,
  privacyRank,
  withinCostCeiling,
  withinLatencyCeiling,
  withinPrivacyCeiling,
} from './ordinals';
import type { ResolveOptions, RouterCandidate, RouterResolution } from './types';
import { RouterError } from './types';

/** The only `LlmCapabilities` keys that are satisfiable boolean flags — `contextWindowTokens` is
 * numeric and is never treated as a pass/fail capability flag; it is ignored (no-op) wherever it
 * appears in `requiredCapabilities`. Numeric context/token sizing is expressed only through the
 * `maxInputTokens`/`maxOutputTokens` budgets. */
const CAPABILITY_FLAG_KEYS: readonly (keyof LlmCapabilities)[] = [
  'toolUse',
  'structuredOutput',
  'vision',
  'streaming',
  'longContext',
];

interface ScoredCandidate {
  readonly candidate: RouterCandidate;
  readonly distance: number;
  readonly unmet: readonly string[];
  readonly providerIndex: number;
  readonly modelIndex: number;
}


function enumerateCandidates(registry: BuiltRegistry): readonly (RouterCandidate & {
  providerIndex: number;
  modelIndex: number;
})[] {
  const candidates: (RouterCandidate & { providerIndex: number; modelIndex: number })[] = [];

  registry.providers.forEach((provider, providerIndex) => {
    provider.models.forEach((model, modelIndex) => {
      candidates.push({ provider, model, providerIndex, modelIndex });
    });
  });

  return candidates;
}


function requiredFlagKeys(
  requiredCapabilities: readonly (keyof LlmCapabilities)[],
  exclude: readonly (keyof LlmCapabilities)[] = [],
): readonly (keyof LlmCapabilities)[] {
  return requiredCapabilities.filter(
    (key): key is (typeof CAPABILITY_FLAG_KEYS)[number] =>
      CAPABILITY_FLAG_KEYS.includes(key) && !exclude.includes(key),
  );
}


function passesHardFilter(
  candidate: RouterCandidate,
  requirements: TaskRequirements,
  flagKeys: readonly (keyof LlmCapabilities)[],
): boolean {

  if (!withinPrivacyCeiling(candidate.provider.privacyClass, requirements.maxPrivacyClass)) return false;
  if (!withinCostCeiling(candidate.model.costClass, requirements.maxCostClass)) return false;
  if (!withinLatencyCeiling(candidate.model.latencyClass, requirements.maxLatencyClass)) return false;

  return flagKeys.every((key) => candidate.model.capabilities[key] === true);
}


/** cost asc → latency asc → privacy asc → registry order (provider index, then model index). */
function compareByRank(
  a: RouterCandidate & { providerIndex: number; modelIndex: number },
  b: RouterCandidate & { providerIndex: number; modelIndex: number },
): number {
  const costDiff = costRank(a.model.costClass) - costRank(b.model.costClass);

  if (costDiff !== 0) return costDiff;

  const latencyDiff = latencyRank(a.model.latencyClass) - latencyRank(b.model.latencyClass);

  if (latencyDiff !== 0) return latencyDiff;

  const privacyDiff = privacyRank(a.provider.privacyClass) - privacyRank(b.provider.privacyClass);

  if (privacyDiff !== 0) return privacyDiff;

  if (a.providerIndex !== b.providerIndex) return a.providerIndex - b.providerIndex;

  return a.modelIndex - b.modelIndex;
}


function computeDistance(
  candidate: RouterCandidate,
  requirements: TaskRequirements,
  flagKeys: readonly (keyof LlmCapabilities)[],
): { distance: number; unmet: readonly string[] } {
  const unmet: string[] = [];
  const lackedFlags = flagKeys.filter((key) => candidate.model.capabilities[key] !== true);

  unmet.push(...lackedFlags);

  const pOverage = privacyOverage(candidate.provider.privacyClass, requirements.maxPrivacyClass);
  const cOverage = costOverage(candidate.model.costClass, requirements.maxCostClass);
  const lOverage = latencyOverage(candidate.model.latencyClass, requirements.maxLatencyClass);

  if (pOverage > 0) unmet.push('privacyClass>max');
  if (cOverage > 0) unmet.push('costClass>max');
  if (lOverage > 0) unmet.push('latencyClass>max');

  return { distance: lackedFlags.length + pOverage + cOverage + lOverage, unmet };
}


function pickMinDistance(
  candidates: readonly (RouterCandidate & { providerIndex: number; modelIndex: number })[],
  requirements: TaskRequirements,
  flagKeys: readonly (keyof LlmCapabilities)[],
): ScoredCandidate {
  const scored: ScoredCandidate[] = candidates.map((candidate) => {
    const { distance, unmet } = computeDistance(candidate, requirements, flagKeys);

    return { candidate, distance, unmet, providerIndex: candidate.providerIndex, modelIndex: candidate.modelIndex };
  });

  scored.sort((a, b) => {

    if (a.distance !== b.distance) return a.distance - b.distance;

    return compareByRank(
      { ...a.candidate, providerIndex: a.providerIndex, modelIndex: a.modelIndex },
      { ...b.candidate, providerIndex: b.providerIndex, modelIndex: b.modelIndex },
    );
  });

  return scored[0];
}


function formatCandidate(candidate: RouterCandidate): string {
  return `${candidate.provider.id}/${candidate.model.id}`;
}


/**
 * Pure metadata-reasoning router: resolves a `TaskRequirements` against a `BuiltRegistry` into a
 * concrete `(provider, model)` pick, an ordered fallback list, and — when nothing passes the
 * hard filters — a `DegradePolicy`-driven fallback outcome. Never constructs or calls an
 * `LlmProvider`; no network, no `Date.now()`/`Math.random()`.
 */

export class CapabilityRouter {

  resolve(
    requirements: TaskRequirements,
    registry: BuiltRegistry,
    opts: ResolveOptions = {},
  ): RouterResolution {
    const policy = opts.degradePolicy ?? 'fail';
    const allCandidates = enumerateCandidates(registry);

    if (allCandidates.length === 0) {
      throw new RouterError(
        `No providers or models are available to satisfy role "${requirements.role}" ` +
          `(registry profile: ${registry.profile}).`,
      );
    }

    const requiredFlags = requiredFlagKeys(requirements.requiredCapabilities);
    const passing = allCandidates.filter((c) => passesHardFilter(c, requirements, requiredFlags));

    if (passing.length > 0) {
      const ranked = [...passing].sort(compareByRank);
      const chosen = ranked[0];

      return {
        provider: chosen.provider,
        model: chosen.model,
        degraded: false,
        unmet: [],
        fallbacks: ranked.map(({ provider, model }) => ({ provider, model })),
        reason: `Selected ${formatCandidate(chosen)} for role "${requirements.role}" — within capability and class ceilings.`,
      };
    }

    if (policy === 'skip') {
      const optional = opts.optionalCapabilities ?? [];
      const relaxedFlags = requiredFlagKeys(requirements.requiredCapabilities, optional);
      const relaxedPassing = allCandidates.filter((c) => passesHardFilter(c, requirements, relaxedFlags));

      if (relaxedPassing.length > 0) {
        const ranked = [...relaxedPassing].sort(compareByRank);
        const chosen = ranked[0];

        return {
          provider: chosen.provider,
          model: chosen.model,
          degraded: false,
          unmet: [],
          fallbacks: ranked.map(({ provider, model }) => ({ provider, model })),
          reason:
            `Selected ${formatCandidate(chosen)} for role "${requirements.role}" ` +
            `after dropping optional capabilities [${optional.join(', ')}].`,
        };
      }
      // falls through to fail
    }

    if (policy === 'degrade' || policy === 'ask') {
      const best = pickMinDistance(allCandidates, requirements, requiredFlags);
      const ranked = [...allCandidates]
        .map((candidate) => ({ candidate, ...computeDistance(candidate, requirements, requiredFlags) }))
        .sort((a, b) => {

          if (a.distance !== b.distance) return a.distance - b.distance;

          return compareByRank(a.candidate, b.candidate);
        })
        .map(({ candidate }) => ({ provider: candidate.provider, model: candidate.model }));

      return {
        provider: best.candidate.provider,
        model: best.candidate.model,
        degraded: true,
        needsConfirmation: policy === 'ask' ? true : undefined,
        unmet: best.unmet,
        fallbacks: ranked,
        reason:
          `No candidate satisfies role "${requirements.role}" within ceilings; ` +
          `degraded to ${formatCandidate(best.candidate)} (distance=${best.distance}, unmet=[${best.unmet.join(', ')}]).`,
      };
    }

    const worst = pickMinDistance(allCandidates, requirements, requiredFlags);

    throw new RouterError(
      `No candidate satisfies role "${requirements.role}": closest is ${formatCandidate(worst.candidate)} ` +
        `but fails [${worst.unmet.join(', ')}].`,
    );
  }
}
