import type { ChatMessage } from '../providers/types';
import type { ContextPack, ContextPackInput, ContextPackOptions } from './types';

/** Conservative default budget (approx tokens) so a pack never floods a premium call by accident. */
const DEFAULT_MAX_TOKENS = 4_000;


/** char/4 heuristic — no tokenizer dependency; deliberately coarse and network-free. */
function approxTokensOf(text: string): number {
  return Math.ceil(text.length / 4);
}


function buildSystemContent(input: ContextPackInput): string {
  const parts: string[] = [];

  if (input.systemPrompt && input.systemPrompt.length > 0) {
    parts.push(input.systemPrompt);
  }

  const snippets = input.snippets ?? [];

  if (snippets.length > 0) {
    const rendered = snippets
      .map((s) => (s.source ? `# ${s.source}\n${s.content}` : s.content))
      .join('\n\n');

    parts.push(`Context:\n${rendered}`);
  }

  return parts.join('\n\n');
}


/**
 * Assemble a compact prompt payload from structured inputs under a conservative token budget.
 *
 * The budget is enforced across the WHOLE pack — `approxTokens` never exceeds it. Priority is:
 * system message (instructions + retrieved snippets) first, then prior messages oldest-first.
 * Prior messages are dropped oldest-first to fit the remaining budget. If the system message
 * alone exceeds the budget it is hard-clamped to the budget (char/4 heuristic) and `truncated`
 * is set; when that happens no prior messages fit. Pure — no network, no tokenizer.
 */

export function buildContextPack(input: ContextPackInput, opts: ContextPackOptions = {}): ContextPack {
  const budget = Math.max(0, opts.maxTokens ?? DEFAULT_MAX_TOKENS);
  const messages: ChatMessage[] = [];
  let systemContent = buildSystemContent(input);
  let truncated = false;
  let approxTokens = 0;

  if (systemContent.length > 0) {

    if (approxTokensOf(systemContent) > budget) {
      // Hard-clamp to the budget so the pack never floods a premium call; budget*4 chars ≈ budget tokens.
      systemContent = systemContent.slice(0, budget * 4);
      truncated = true;
    }

    messages.push({ role: 'system', content: systemContent });
    approxTokens += approxTokensOf(systemContent);
  }

  const priorMessages = input.priorMessages ?? [];
  const remaining = budget - approxTokens;
  const kept: ChatMessage[] = [];
  let used = 0;

  for (let i = priorMessages.length - 1; i >= 0; i -= 1) {
    const cost = approxTokensOf(priorMessages[i].content);

    if (used + cost <= remaining) {
      kept.unshift({ ...priorMessages[i] });
      used += cost;
    } else {

      break;
    }
  }

  messages.push(...kept);
  approxTokens += used;

  const dropped = priorMessages.length - kept.length;

  return { messages, approxTokens, dropped, truncated };
}
