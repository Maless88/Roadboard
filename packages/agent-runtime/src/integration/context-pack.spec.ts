import type { ChatMessage } from '../providers/types';
import { buildContextPack } from './context-pack';


function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}


describe('buildContextPack', () => {

  it('is pure and returns an empty pack for empty input', () => {
    const pack = buildContextPack({});

    expect(pack.messages).toEqual([]);
    expect(pack.approxTokens).toBe(0);
    expect(pack.dropped).toBe(0);
  });


  it('always retains the system message with folded snippets', () => {
    const pack = buildContextPack({
      systemPrompt: 'You are a dev agent.',
      snippets: [{ source: 'a.ts', content: 'export const x = 1;' }],
    });

    expect(pack.messages).toHaveLength(1);
    expect(pack.messages[0].role).toBe('system');
    expect(pack.messages[0].content).toContain('You are a dev agent.');
    expect(pack.messages[0].content).toContain('a.ts');
    expect(pack.messages[0].content).toContain('export const x = 1;');
    expect(pack.dropped).toBe(0);
  });


  it('reports approxTokens via the char/4 heuristic', () => {
    const content = 'a'.repeat(40);
    const pack = buildContextPack({ systemPrompt: content });

    // 40 chars / 4 = 10
    expect(pack.approxTokens).toBe(10);
  });


  it('truncates prior messages oldest-first at the budget boundary and reports dropped', () => {
    const prior: ChatMessage[] = [
      msg('user', 'a'.repeat(40)),      // oldest — 10 tokens
      msg('assistant', 'b'.repeat(40)), // 10 tokens
      msg('user', 'c'.repeat(40)),      // newest — 10 tokens
    ];

    // budget 20 tokens, no system message → only the two most recent fit, oldest dropped.
    const pack = buildContextPack({ priorMessages: prior }, { maxTokens: 20 });

    expect(pack.dropped).toBe(1);
    expect(pack.messages).toHaveLength(2);
    expect(pack.messages[0].content).toBe('b'.repeat(40));
    expect(pack.messages[1].content).toBe('c'.repeat(40));
    expect(pack.approxTokens).toBe(20);
  });


  it('subtracts the system budget before fitting prior messages', () => {
    const prior: ChatMessage[] = [
      msg('user', 'a'.repeat(40)),
      msg('user', 'b'.repeat(40)),
    ];

    // system = 40 chars → 10 tokens; budget 20 → 10 left → only one prior message fits.
    const pack = buildContextPack(
      { systemPrompt: 's'.repeat(40), priorMessages: prior },
      { maxTokens: 20 },
    );

    expect(pack.dropped).toBe(1);
    expect(pack.messages).toHaveLength(2);
    expect(pack.messages[0].role).toBe('system');
    expect(pack.messages[1].content).toBe('b'.repeat(40));
  });


  it('hard-clamps the system message to the budget and drops every prior message', () => {
    const pack = buildContextPack(
      { systemPrompt: 's'.repeat(400), priorMessages: [msg('user', 'x')] },
      { maxTokens: 10 },
    );

    expect(pack.dropped).toBe(1);
    expect(pack.messages).toHaveLength(1);
    expect(pack.messages[0].role).toBe('system');
    // Budget is enforced across the whole pack — never over-budget.
    expect(pack.approxTokens).toBeLessThanOrEqual(10);
    expect(pack.truncated).toBe(true);
    // 10 tokens * 4 chars/token = 40 chars retained.
    expect(pack.messages[0].content).toHaveLength(40);
  });


  it('does not flag truncation when the pack fits the budget', () => {
    const pack = buildContextPack({ systemPrompt: 'short' }, { maxTokens: 100 });

    expect(pack.truncated).toBe(false);
    expect(pack.approxTokens).toBeLessThanOrEqual(100);
  });
});
