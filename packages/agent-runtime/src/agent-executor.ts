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
}

const API_PROVIDERS: readonly ProviderName[] = ["openai", "anthropic", "ollama"];

/**
 * Runs an agent against an LLM, selecting provider/runtime per AgentExecConfig.
 * Reuses the chatbot providers for api/local; CLI runtimes (claude-code/codex
 * headless) proxy through the agent CLI bridge. Framework-agnostic so both
 * core-api (chat turns) and worker-jobs (scheduled runs) can share it.
 */
export class AgentExecutor {

  stream(agent: AgentExecConfig, messages: ChatMessage[]): AsyncIterable<string> {

    if (agent.runtime === "cli") {
      return this.streamCli(agent, messages);
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
  ): AsyncIterable<string> {

    const url = optionalEnv("AGENT_CLI_BRIDGE_URL", "http://host.docker.internal:8787/run");
    const token = optionalEnv("AGENT_CLI_BRIDGE_TOKEN", "");
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: agent.provider, model: agent.model, prompt, cwd: agent.workspacePath ?? undefined, contextMd: agent.systemPrompt ?? undefined, toolPolicy: agent.toolPolicy ?? "restricted" }),
    });

    if (!res.ok || !res.body) {
      throw new ProviderError(`CLI bridge error ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
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
