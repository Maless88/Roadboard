import { getArchitectureGraph } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import { EmptyState } from './empty-state';
import { ArchitectureMapCanvas } from './architecture-map-canvas';


interface Props {
  token: string;
  projectId: string;
  dict: Dictionary;
}


export async function ArchitectureMapView({ token, projectId, dict }: Props) {

  let graph;

  try {
    graph = await getArchitectureGraph(token, projectId);
  } catch {
    return <EmptyState title={dict.codeflow.loadError} />;
  }

  if (graph.nodes.length === 0) {
    return (
      <EmptyState
        title={dict.codeflow.notScanned}
        hint={dict.codeflow.notScannedHint}
      />
    );
  }

  const lastScanned = graph.lastScannedAt
    ? new Date(graph.lastScannedAt).toLocaleString('it-IT', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>{dict.codeflow.nodeCount(graph.nodes.length)}</span>
        <span className="text-gray-700">·</span>
        <span>{dict.codeflow.edgeCount(graph.edges.length)}</span>
        {graph.snapshotStatus && (
          <>
            <span className="text-gray-700">·</span>
            <span>{dict.codeflow.snapshotStatus(graph.snapshotStatus)}</span>
          </>
        )}
        {lastScanned && (
          <>
            <span className="text-gray-700">·</span>
            <span>{dict.codeflow.lastScannedAt(lastScanned)}</span>
          </>
        )}
      </div>

      <ArchitectureMapCanvas
        projectId={projectId}
        nodes={graph.nodes}
        edges={graph.edges}
        dict={{
          searchPlaceholder: dict.codeflow.searchPlaceholder,
          filterAll: dict.codeflow.filterAll,
          noNodes: dict.codeflow.noNodes,
        }}
      />
    </div>
  );
}
