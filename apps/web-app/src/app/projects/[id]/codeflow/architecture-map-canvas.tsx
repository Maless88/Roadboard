'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import dagre from 'dagre';
import type { ArchitectureNode, ArchitectureEdge } from '@/lib/api';
import { NodeDrawer } from './node-drawer';
import { useTheme } from '@/lib/theme-context';

import '@xyflow/react/dist/style.css';


interface CanvasDict {
  searchPlaceholder: string;
  filterAll: string;
  noNodes: string;
}


interface Props {
  projectId: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  dict: CanvasDict;
}


const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;


type Palette = { bg: string; border: string; text: string };
type TypePalettes = Record<string, Palette>;


const TYPE_COLORS_DARK: TypePalettes = {
  app: { bg: 'rgba(99,102,241,0.18)', border: '#6366f1', text: '#c7d2fe' },
  package: { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#a7f3d0' },
  module: { bg: 'rgba(234,179,8,0.18)', border: '#eab308', text: '#fef08a' },
  service: { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#fbcfe8' },
};

const TYPE_COLORS_LIGHT: TypePalettes = {
  app: { bg: '#e0e7ff', border: '#4338ca', text: '#1e1b4b' },
  package: { bg: '#d1fae5', border: '#047857', text: '#064e3b' },
  module: { bg: '#fef3c7', border: '#b45309', text: '#78350f' },
  service: { bg: '#fce7f3', border: '#be185d', text: '#831843' },
};

const DEFAULT_DARK: Palette = { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.25)', text: '#d1d5db' };
const DEFAULT_LIGHT: Palette = { bg: '#f3f4f6', border: '#6b7280', text: '#1f2937' };


function layoutGraph(
  archNodes: ArchitectureNode[],
  archEdges: ArchitectureEdge[],
  palette: { types: TypePalettes; fallback: Palette; edgeStroke: string; edgeLabel: string; nodeShadow: string },
): { nodes: Node[]; edges: Edge[] } {

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  archNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  archEdges.forEach((e) => g.setEdge(e.fromNodeId, e.toNodeId));

  dagre.layout(g);

  const nodes: Node[] = archNodes.map((n) => {
    const { x, y } = g.node(n.id);
    const colors = palette.types[n.type] ?? palette.fallback;

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
        border: `1.5px solid ${colors.border}`,
        borderRadius: 8,
        padding: 0,
        fontSize: 12,
        boxShadow: palette.nodeShadow,
      },
    };
  });

  const edges: Edge[] = archEdges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.edgeType === 'depends_on' ? undefined : e.edgeType,
    animated: e.edgeType === 'depends_on',
    style: { stroke: palette.edgeStroke, strokeWidth: 1.2 },
    labelStyle: { fontSize: 10, fill: palette.edgeLabel },
  }));

  return { nodes, edges };
}


export function ArchitectureMapCanvas({ projectId, nodes: archNodes, edges: archEdges, dict }: Props) {

  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const palette = useMemo(() => theme === 'light'
    ? {
        types: TYPE_COLORS_LIGHT,
        fallback: DEFAULT_LIGHT,
        edgeStroke: 'rgba(17,24,39,0.45)',
        edgeLabel: '#374151',
        gridColor: 'rgba(17,24,39,0.1)',
        canvasBg: '#ffffff',
        nodeShadow: '0 1px 2px rgba(17,24,39,0.08), 0 1px 3px rgba(17,24,39,0.1)',
      }
    : {
        types: TYPE_COLORS_DARK,
        fallback: DEFAULT_DARK,
        edgeStroke: 'rgba(255,255,255,0.25)',
        edgeLabel: '#9ca3af',
        gridColor: 'rgba(255,255,255,0.06)',
        canvasBg: 'rgba(0,0,0,0.2)',
        nodeShadow: '0 1px 3px rgba(0,0,0,0.3)',
      },
  [theme]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

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
    () => layoutGraph(filtered.nodes, filtered.edges, palette),
    [filtered, palette],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.searchPlaceholder}
          className="px-3 py-1.5 text-xs rounded-lg placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)', minWidth: 200 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500"
          style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
        >
          <option value="all" style={{ background: 'var(--surface-overlay)', color: 'var(--text)' }}>{dict.filterAll}</option>
          {availableTypes.map((t) => (
            <option key={t} value={t} style={{ background: 'var(--surface-overlay)', color: 'var(--text)' }}>{t}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border-soft)', height: 560, background: palette.canvasBg }}
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
            onNodeClick={handleNodeClick}
          >
            <Background color={palette.gridColor} gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      <NodeDrawer
        projectId={projectId}
        nodeId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
