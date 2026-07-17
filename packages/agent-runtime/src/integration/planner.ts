import type { AgentRole } from '../capability/contract';
import type { BuiltRegistry } from '../registry/types';
import { CapabilityRouter } from '../router/capability-router';
import { buildContextPack } from './context-pack';
import { resolveRequirements } from './role-requirements';
import type { AgentTurnPlan, PlanAgentTurnOptions } from './types';


/** True when at least one `(provider, model)` candidate is enumerable in the registry. */
function hasEnumerableCandidates(registry: BuiltRegistry): boolean {
  return registry.providers.some((p) => p.models.length > 0);
}


/**
 * Compose role requirements + capability routing + a compact context pack into a single
 * `AgentTurnPlan`. Pure over the injected `registry` and inputs.
 *
 * Never throws for a normal empty registry: it PRE-CHECKS candidate presence and returns the
 * `ok: false` no-candidates variant instead of calling `CapabilityRouter.resolve()` (which would
 * throw a `RouterError` before any `DegradePolicy` is applied). When candidates exist, `resolve()`
 * runs on the known-non-empty registry with a conservative `degrade` policy, so a genuine
 * capability shortfall surfaces as `resolution.degraded === true` rather than an exception.
 */

export function planAgentTurn(
  role: AgentRole,
  registry: BuiltRegistry,
  opts: PlanAgentTurnOptions = {},
): AgentTurnPlan {
  const requirements = resolveRequirements(role, opts.overrides);
  const contextPack = buildContextPack(opts.context ?? {}, opts.contextOptions);

  if (!hasEnumerableCandidates(registry)) {

    return {
      ok: false,
      reason: 'no-candidates',
      contextPack,
      requirements,
      detail:
        `No (provider, model) candidate is available for role "${role}" ` +
        `(registry profile: ${registry.profile}).`,
    };
  }

  const router = new CapabilityRouter();
  const resolution = router.resolve(requirements, registry, opts.resolveOptions ?? { degradePolicy: 'degrade' });

  return { ok: true, resolution, contextPack, requirements };
}
