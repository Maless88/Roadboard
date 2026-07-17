import type { AgentUsage } from '../agent-executor';
import type { LlmUsage } from '../capability/contract';

/**
 * Bidirectional mappers between the two parallel usage shapes in the runtime:
 * `LlmUsage` (contract) and `AgentUsage` (live `agent-executor`). Neither side is redefined; the
 * mappers reconcile the overlapping fields losslessly, defaulting absent optional values to 0.
 */


export function llmUsageToAgentUsage(usage: LlmUsage): AgentUsage {
  return {
    in: usage.inputTokens ?? 0,
    out: usage.outputTokens ?? 0,
    cc: usage.cacheCreationTokens ?? 0,
    cr: usage.cacheReadTokens ?? 0,
  };
}


export function agentUsageToLlmUsage(usage: AgentUsage): LlmUsage {
  return {
    inputTokens: usage.in ?? 0,
    outputTokens: usage.out ?? 0,
    cacheCreationTokens: usage.cc ?? 0,
    cacheReadTokens: usage.cr ?? 0,
  };
}
