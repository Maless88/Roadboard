import { getProjectArchitectureSnapshot } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import { EmptyState } from './empty-state';
import { AgentContextPanel } from './agent-context-panel';


interface Props {
  token: string;
  projectId: string;
  dict: Dictionary;
}


export async function AgentContextView({ token, projectId, dict }: Props) {

  let snapshot;

  try {
    snapshot = await getProjectArchitectureSnapshot(token, projectId);
  } catch (err) {
    const status = (err as { status?: number }).status;

    if (status === 404 || status === 204) {
      return (
        <EmptyState
          title={dict.codeflow.subNav.agentContext}
          hint={dict.codeflow.agentContext.noSnapshot}
        />
      );
    }

    return <EmptyState title={dict.codeflow.agentContext.loadError} />;
  }

  return (
    <AgentContextPanel
      snapshot={snapshot}
      projectId={projectId}
    />
  );
}
