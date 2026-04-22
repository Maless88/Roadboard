'use client';

import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import dagre from 'dagre';
import type { ArchitectureNode, ArchitectureEdge } from '@/lib/api';

import '@xyflow/react/dist/style.css';


interface CanvasDict {
  searchPlaceholder: string;
  filterAll: string;
  noNodes: string;
}


interface Props {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  dict: CanvasDict;
}


const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;


const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  app: { bg: 'rgba(99,102,241,0.18)', border: '#6366f1', text: '#c7d2fe' },
  package: { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#a7f3d0' },
  module: { bg: 'rgba(234,179,8,0.18)', border: '#eab308', text: '#fef08a' },
  service: { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#fbcfe8' },
};


const DEFAULT_COLORS = { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.25)', text: '#d1d5db' };


function layoutGraph(
  archNodes: ArchitectureNode[],
  archEdges: ArchitectureEdge[],
): { nodes: Node[]; edges: Edge[] } {

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  archNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  archEdges.forEach((e) => g.setEdge(e.fromNodeId, e.toNodeId));

  dagre.layout(g);

  const nodes: Node[] = archNodes.map((n) => {
    const { x, y } = g.node(n.id);
    const colors = TYPE_COLORS[n.type] ?? DEFAULT_COLORS;

    return {
      id: n.id,
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: {
        label: (
          <div className="flex flex-col items-start gap-0.5 px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: colors.text, opacity: 0.7 }}>
              {n.type}
            </span>
            <span className="text-xs font-medium truncate w-full" style={{ color: colors.text }}>
              {n.name}
            </span>
          </div>
        ),
      },
      style: {
        width: NODE_WIDTH,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: 0,
        fontSize: 12,
      },
    };
  });

  const edges: Edge[] = archEdges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.edgeType === 'depends_on' ? undefined : e.edgeType,
    animated: e.edgeType === 'depends_on',
    style: { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1.2 },
    labelStyle: { fontSize: 10, fill: '#9ca3af' },
  }));

  return { nodes, edges };
}


export function ArchitectureMapCanvas({ nodes: archNodes, edges: archEdges, dict }: Props) {

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const availableTypes = useMemo(
    () => Array.from(new Set(archNodes.map((n) => n.type))).sort(),
    [archNodes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const keepNode = (n: ArchitectureNode) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;

      if (q && !(n.name.toLowerCase().includes(q) || (n.path?.toLowerCase().includes(q) ?? false))) {
        return false;
      }

      return true;
    };

    const visibleNodes = archNodes.filter(keepNode);
    const ids = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = archEdges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId));

    return { nodes: visibleNodes, edges: visibleEdges };
  }, [archNodes, archEdges, query, typeFilter]);

  const { nodes: rfNodes, edges: rfEdges } = useMemo(
    () => layoutGraph(filtered.nodes, filtered.edges),
    [filtered],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.searchPlaceholder}
          className="px-3 py-1.5 text-xs rounded-lg bg-transparent text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
          style={{ border: '1px solid rgba(255,255,255,0.08)', minWidth: 200 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-transparent text-gray-200 focus:outline-none focus:border-indigo-500"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <option value="all">{dict.filterAll}</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', height: 560, background: 'rgba(0,0,0,0.2)' }}
      >
        {rfNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            {dict.noNodes}
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background color="rgba(255,255,255,0.06)" gap={16} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.5)" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
