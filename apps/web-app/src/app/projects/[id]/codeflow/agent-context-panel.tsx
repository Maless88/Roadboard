'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ArchitectureSnapshot } from '@/lib/api';
import { useDict } from '@/lib/i18n/locale-context';
import { useToast } from '@/lib/toast-context';


interface Props {
  snapshot: ArchitectureSnapshot;
  projectId: string;
}


function SectionTitle({ children }: { children: React.ReactNode }) {

  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
      {children}
    </h3>
  );
}


function TypeBadge({ label, count }: { label: string; count: number }) {

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
      <span className="text-gray-300">{label}</span>
      <span className="text-indigo-400 font-semibold">{count}</span>
    </span>
  );
}


export function AgentContextPanel({ snapshot, projectId }: Props) {

  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [copying, setCopying] = useState(false);

  const d = useDict().codeflow.agentContext;

  const generatedAt = new Date(snapshot.generatedAt).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = useCallback(async () => {

    setCopying(true);

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      showToast(d.copied, 'success');
    } catch {
      showToast(d.copyError, 'error');
    } finally {
      setCopying(false);
    }
  }, [snapshot, d, showToast]);

  const handleFocusNode = useCallback((nodeId: string) => {

    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'codeflow');
    params.set('cf', 'map');
    params.set('file', nodeId);
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, searchParams, router]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>{d.generatedAt(generatedAt)}</span>
          <span className="text-gray-700">·</span>
          <span>{d.nodeCount(snapshot.nodeCount)}</span>
          <span className="text-gray-700">·</span>
          <span>{d.edgeCount(snapshot.edgeCount)}</span>
        </div>

        <button
          onClick={handleCopy}
          disabled={copying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-indigo-500/10 text-indigo-400 border border-indigo-500/20
            hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
        >
          {copying ? '…' : d.copyButton}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <SectionTitle>{d.nodesByType}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(snapshot.summary.nodesByType).map(([type, count]) => (
              <TypeBadge key={type} label={type} count={count} />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>{d.edgesByType}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(snapshot.summary.edgesByType).map(([type, count]) => (
              <TypeBadge key={type} label={type} count={count} />
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 impact nodes */}
      <div>
        <SectionTitle>{d.topImpactNodes}</SectionTitle>
        <div className="space-y-2">
          {snapshot.topImpactNodes.map((node) => (
            <div
              key={node.nodeId}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 font-mono shrink-0">{node.type}</span>
                <span className="text-sm text-gray-200 truncate">{node.name}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-400 font-semibold">
                  {d.dependants(node.directDependants)}
                </span>
                <button
                  onClick={() => handleFocusNode(node.nodeId)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-1.5 py-0.5
                    rounded border border-indigo-500/20 hover:border-indigo-400/40"
                >
                  {d.focusNode}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent annotations */}
      {snapshot.recentAnnotations.length > 0 && (
        <div>
          <SectionTitle>{d.recentAnnotations}</SectionTitle>
          <div className="space-y-2">
            {snapshot.recentAnnotations.map((ann, i) => (
              <div
                key={`${ann.nodeId}-${i}`}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
              >
                <div className="text-xs text-gray-400 mb-1">{d.annotationOn(ann.nodeName)}</div>
                <div className="text-gray-200 leading-relaxed">{ann.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON */}
      <div>
        <SectionTitle>JSON</SectionTitle>
        <pre
          className="text-xs font-mono text-gray-400 rounded-lg p-3 overflow-auto max-h-64
            leading-relaxed whitespace-pre-wrap break-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </div>
    </div>
  );
}
