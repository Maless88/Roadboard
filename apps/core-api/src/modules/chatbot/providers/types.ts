// Re-export shim — single source of truth lives in @roadboard/agent-runtime
// so both core-api (chat turns) and worker-jobs (scheduled runs) share it.
export type {
  ChatRole,
  ChatMessage,
  ChatProviderConfig,
  ChatProvider,
} from "@roadboard/agent-runtime";
export { ProviderError } from "@roadboard/agent-runtime";
