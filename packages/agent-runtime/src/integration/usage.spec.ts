import type { AgentUsage } from '../agent-executor';
import type { LlmUsage } from '../capability/contract';
import { agentUsageToLlmUsage, llmUsageToAgentUsage } from './usage';


describe('usage mappers', () => {

  it('maps LlmUsage → AgentUsage across the overlapping fields', () => {
    const llm: LlmUsage = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 10,
      cacheReadTokens: 5,
    };

    expect(llmUsageToAgentUsage(llm)).toEqual({ in: 100, out: 50, cc: 10, cr: 5 });
  });


  it('defaults absent optional cache fields to 0 when mapping LlmUsage → AgentUsage', () => {
    const llm: LlmUsage = { inputTokens: 7, outputTokens: 3 };

    expect(llmUsageToAgentUsage(llm)).toEqual({ in: 7, out: 3, cc: 0, cr: 0 });
  });


  it('maps AgentUsage → LlmUsage across all fields', () => {
    const agent: AgentUsage = { in: 100, out: 50, cc: 10, cr: 5 };

    expect(agentUsageToLlmUsage(agent)).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 10,
      cacheReadTokens: 5,
    });
  });


  it('round-trips LlmUsage → AgentUsage → LlmUsage losslessly', () => {
    const llm: LlmUsage = {
      inputTokens: 123,
      outputTokens: 456,
      cacheCreationTokens: 7,
      cacheReadTokens: 8,
    };

    expect(agentUsageToLlmUsage(llmUsageToAgentUsage(llm))).toEqual(llm);
  });


  it('round-trips AgentUsage → LlmUsage → AgentUsage losslessly', () => {
    const agent: AgentUsage = { in: 9, out: 8, cc: 7, cr: 6 };

    expect(llmUsageToAgentUsage(agentUsageToLlmUsage(agent))).toEqual(agent);
  });
});
