import { Injectable } from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";
import {
  getProvider,
  ProviderError,
  type ChatMessage,
  type ChatProviderConfig,
  type ProviderName,
} from "../chatbot/providers";

export type AgentRuntime = "api" | "cli" | "local";

export interface AgentExecConfig {
  runtime: AgentRuntime;
  provider: string; // anthropic | openai | ollama | claude-code | codex
  model: string;
  systemPrompt?: string | null;
}

const API_PROVIDERS: readonly ProviderName[] = ["openai", "anthropic", "ollama"];

/**
 * Runs an agent against an LLM, selecting provider/runtime per AgentConfig.
 * Reuses the existing chatbot providers for api/local; CLI runtimes
 * (claude-code/codex headless) are a tracked follow-up.
 */
@Injectable()
export class AgentExecutorService {

  stream(agent: AgentExecConfig, messages: ChatMessage[]): AsyncIterable<string> {

    const full: ChatMessage[] = agent.systemPrompt
      ? [{ role: "system", content: agent.systemPrompt }, ...messages]
      : messages;

    if (agent.runtime === "cli") {
      throw new ProviderError(
        `CLI runtime not yet implemented (provider=${agent.provider})`,
      );
    }

    const name = agent.provider as ProviderName;

    if (!API_PROVIDERS.includes(name)) {
      throw new ProviderError(
        `Unsupported provider for runtime ${agent.runtime}: ${agent.provider}`,
      );
    }

    return getProvider(name).stream(full, this.resolveConfig(name, agent.model));
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
