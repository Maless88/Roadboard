import { optionalEnv } from "@roadboard/config";
import {
  getProvider,
  ProviderError,
  type ChatMessage,
  type ChatProviderConfig,
  type ProviderName,
} from "./providers";

export type AgentRuntime = "api" | "cli" | "local";

export interface AgentExecConfig {
  runtime: AgentRuntime;
  provider: string; // anthropic | openai | ollama | claude-code | codex
  model: string;
  systemPrompt?: string | null;
  workspacePath?: string | null;
  toolPolicy?: string | null; // restricted | dev | sysadmin
  roadboardMcpUrl?: string | null;
  roadboardMcpToken?: string | null;
  projectId?: string | null;
  source?: string | null; // chat | scheduled
  repoUrl?: string | null;
}

export interface AgentUsage {
  in: number;
  out: number;
  cc: number;
  cr: number;
}

/**
 * Mutable bag populated by streamCli when the bridge emits a __rb_tok__ sentinel.
 * Callers pass an empty object and read .usage after the stream ends.
 */
export interface AgentRunSidecar {
  usage?: AgentUsage;
}

const API_PROVIDERS: readonly ProviderName[] = ["openai", "anthropic", "ollama"];

// Sentinel emitted by the bridge after the result text.
const USAGE_SENTINEL = "\n__rb_tok__:";

/**
 * Runs an agent against an LLM, selecting provider/runtime per AgentExecConfig.
 * Reuses the chatbot providers for api/local; CLI runtimes (claude-code/codex
 * headless) proxy through the agent CLI bridge. Framework-agnostic so both
 * core-api (chat turns) and worker-jobs (scheduled runs) can share it.
 */
export class AgentExecutor {

  stream(agent: AgentExecConfig, messages: ChatMessage[], sidecar?: AgentRunSidecar): AsyncIterable<string> {

    if (agent.runtime === "cli") {
      return this.streamCli(agent, messages, sidecar);
    }

    const full: ChatMessage[] = agent.systemPrompt
      ? [{ role: "system", content: agent.systemPrompt }, ...messages]
      : messages;

    const name = agent.provider as ProviderName;

    if (!API_PROVIDERS.includes(name)) {
      throw new ProviderError(
        `Unsupported provider for runtime ${agent.runtime}: ${agent.provider}`,
      );
    }

    return getProvider(name).stream(full, this.resolveConfig(name, agent.model));
  }

  private async *streamCli(
    agent: AgentExecConfig,
    messages: ChatMessage[],
    sidecar?: AgentRunSidecar,
  ): AsyncIterable<string> {

    const url = optionalEnv("AGENT_CLI_BRIDGE_URL", "http://host.docker.internal:8787/run");
    const token = optionalEnv("AGENT_CLI_BRIDGE_TOKEN", "");
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: agent.provider, model: agent.model, prompt, cwd: agent.workspacePath ?? undefined, contextMd: agent.systemPrompt ?? undefined, toolPolicy: agent.toolPolicy ?? "restricted", roadboardMcpUrl: agent.roadboardMcpUrl ?? undefined, roadboardMcpToken: agent.roadboardMcpToken ?? undefined, projectId: agent.projectId ?? undefined, source: agent.source ?? undefined, repoUrl: agent.repoUrl ?? undefined, stream: agent.source === "chat" }),
    });

    if (!res.ok || !res.body) {
      throw new ProviderError(`CLI bridge error ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    // Buffer up to len(USAGE_SENTINEL) extra chars to avoid splitting sentinel across chunks.
    let trail = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        if (trail) {
          const idx = trail.indexOf(USAGE_SENTINEL);

          if (idx !== -1) {
            if (idx > 0) yield trail.slice(0, idx);
            if (sidecar) {
              try { sidecar.usage = JSON.parse(trail.slice(idx + USAGE_SENTINEL.length).trim()) as AgentUsage; } catch { /* ignore malformed */ }
            }
          } else {
            yield trail;
          }
        }
        break;
      }

      const text = decoder.decode(value, { stream: true });
      trail += text;

      const idx = trail.indexOf(USAGE_SENTINEL);

      if (idx !== -1) {
        if (idx > 0) yield trail.slice(0, idx);
        const after = trail.slice(idx + USAGE_SENTINEL.length);
        // JSON complete when it ends with '}'
        if (after.trimEnd().endsWith("}")) {
          if (sidecar) {
            try { sidecar.usage = JSON.parse(after.trim()) as AgentUsage; } catch { /* ignore malformed */ }
          }
          trail = "";
        } else {
          // Incomplete JSON — keep buffering without re-emitting the sentinel prefix
          trail = USAGE_SENTINEL + after;
        }
      } else {
        // No sentinel yet: yield safe prefix (all but last USAGE_SENTINEL.length chars)
        const safeLen = Math.max(0, trail.length - USAGE_SENTINEL.length);
        if (safeLen > 0) {
          yield trail.slice(0, safeLen);
          trail = trail.slice(safeLen);
        }
      }
    }
  }

  private resolveConfig(name: ProviderName, model: string): ChatProviderConfig {

    switch (name) {

      case "openai":
        return { apiKey: optionalEnv("OPENAI_API_KEY", ""), model };

      case "anthropic":
        return { apiKey: optionalEnv("ANTHROPIC_API_KEY", ""), model };

      case "ollama":
        return { baseUrl: optionalEnv("OLLAMA_BASE_URL", "http://localhost:11434"), model };

      default: {
        const _exhaustive: never = name;
        throw new ProviderError(`Unknown provider: ${String(_exhaustive)}`);
      }
    }
  }
}
