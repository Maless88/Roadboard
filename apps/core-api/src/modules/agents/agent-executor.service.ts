import { Injectable } from "@nestjs/common";
import { AgentExecutor } from "@roadboard/agent-runtime";

export type { AgentExecConfig, AgentRuntime } from "@roadboard/agent-runtime";

/**
 * NestJS-injectable wrapper around the framework-agnostic AgentExecutor
 * (in @roadboard/agent-runtime). Keeps the existing DI token + import path
 * stable for core-api consumers while sharing the runtime with worker-jobs.
 */
@Injectable()
export class AgentExecutorService extends AgentExecutor {}
