import type { AgentRole, TaskRequirements } from '../capability/contract';
import type { RequirementOverrides } from './types';

/**
 * Conservative default `TaskRequirements` per `AgentRole`.
 *
 * These defaults never escalate to a premium tier on their own: `intake`/`router` stay local, free,
 * and realtime; `dev`/`security` declare the capabilities they genuinely need (tool use, long
 * context) but do not force a specific expensive model; `researcher` tolerates higher cost/batch;
 * `assistant` is the general streaming fallback. Escalation is expressed ONLY through explicit
 * `overrides` passed to `resolveRequirements` — there is no automatic premium escalation.
 */
const DEFAULT_ROLE_REQUIREMENTS: Readonly<Record<AgentRole, TaskRequirements>> = {
  intake: {
    role: 'intake',
    requiredCapabilities: [],
    maxPrivacyClass: 'local',
    maxCostClass: 'free',
    maxLatencyClass: 'realtime',
  },
  router: {
    role: 'router',
    requiredCapabilities: ['structuredOutput'],
    maxPrivacyClass: 'local',
    maxCostClass: 'free',
    maxLatencyClass: 'realtime',
  },
  dev: {
    role: 'dev',
    requiredCapabilities: ['toolUse', 'longContext'],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'high',
    maxLatencyClass: 'batch',
  },
  security: {
    role: 'security',
    requiredCapabilities: ['toolUse', 'longContext', 'structuredOutput'],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'high',
    maxLatencyClass: 'batch',
  },
  researcher: {
    role: 'researcher',
    requiredCapabilities: ['longContext'],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'high',
    maxLatencyClass: 'batch',
  },
  assistant: {
    role: 'assistant',
    requiredCapabilities: ['streaming'],
    maxPrivacyClass: 'public-cloud',
    maxCostClass: 'medium',
    maxLatencyClass: 'interactive',
  },
};


/** Read-only view of the default requirement table, keyed by role. */
export function defaultRequirements(role: AgentRole): TaskRequirements {
  return DEFAULT_ROLE_REQUIREMENTS[role];
}


/**
 * Resolve the effective `TaskRequirements` for a role, applying any explicit `overrides` on top of
 * the conservative defaults. The `role` is always pinned to the argument and cannot be overridden.
 */

export function resolveRequirements(role: AgentRole, overrides: RequirementOverrides = {}): TaskRequirements {
  const base = DEFAULT_ROLE_REQUIREMENTS[role];

  return { ...base, ...overrides, role };
}
