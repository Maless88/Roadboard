// Mirrors apps/worker-jobs/src/jobs/queue-names.ts (QUEUE_AGENT_RUN). Kept local
// to avoid a core-api → worker-jobs dependency; the literal must stay in sync.
export const QUEUE_AGENT_RUN = "agent-run";

export interface AgentRunJobData {
  activityId: string;
  runId: string;
}
