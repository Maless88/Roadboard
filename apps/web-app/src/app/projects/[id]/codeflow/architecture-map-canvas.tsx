'use client';

import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeProps,
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


const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;


type Palette = { bg: string; border: string; text: string };
type TypePalettes = Record<string, Palette>;


const TYPE_COLORS_DARK: TypePalettes = {
  app: { bg: 'rgba(99,102,241,0.18)', border: '#6366f1', text: '#c7d2fe' },
  package: { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#a7f3d0' },
  module: { bg: 'rgba(234,179,8,0.18)', border: '#eab308', text: '#fef08a' },
  service: { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#fbcfe8' },
  file: { bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', text: '#bae6fd' },
  symbol: { bg: 'rgba(167,139,250,0.18)', border: '#a78bfa', text: '#ddd6fe' },
};

const TYPE_COLORS_LIGHT: TypePalettes = {
  app: { bg: '#e0e7ff', border: '#4338ca', text: '#1e1b4b' },
  package: { bg: '#d1fae5', border: '#047857', text: '#064e3b' },
  module: { bg: '#fef3c7', border: '#b45309', text: '#78350f' },
  service: { bg: '#fce7f3', border: '#be185d', text: '#831843' },
  file: { bg: '#e0f2fe', border: '#0369a1', text: '#0c4a6e' },
  symbol: { bg: '#ede9fe', border: '#6d28d9', text: '#3b0764' },
};

const DEFAULT_DARK: Palette = { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.25)', text: '#d1d5db' };
const DEFAULT_LIGHT: Palette = { bg: '#f3f4f6', border: '#6b7280', text: '#1f2937' };


interface HierNode {
  node: ArchitectureNode;
  parentId: string | null;
  childIds: string[];
  depth: number;
}


function buildHierarchy(archNodes: ArchitectureNode[]): Map<string, HierNode> {

  const sorted = [...archNodes].sort((a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0));
  const map = new Map<string, HierNode>();

  for (const n of sorted) {
    let parentId: string | null = null;
    let bestLen = -1;

    if (n.path) {

      for (const m of sorted) {

        if (m.id === n.id || !m.path) continue;

        if (n.path.startsWith(m.path + '/') && m.path.length > bestLen) {
          parentId = m.id;
          bestLen = m.path.length;
        }
      }
    }

    const depth = parentId ? (map.get(parentId)?.depth ?? 0) + 1 : 0;
    map.set(n.id, { node: n, parentId, childIds: [], depth });
  }

  for (const h of map.values()) {

    if (h.parentId) {
      map.get(h.parentId)?.childIds.push(h.node.id);
    }
  }

  return map;
}


function isVisible(id: string, hier: Map<string, HierNode>, expanded: Set<string>): boolean {

  let cur = hier.get(id);

  while (cur && cur.parentId) {

    if (!expanded.has(cur.parentId)) return false;

    cur = hier.get(cur.parentId);
  }

  return true;
}


function nearestVisibleAncestor(
  id: string,
  hier: Map<string, HierNode>,
  expanded: Set<string>,
): string | null {

  let cur = hier.get(id);

  while (cur) {

    if (isVisible(cur.node.id, hier, expanded)) return cur.node.id;

    if (!cur.parentId) return null;

    cur = hier.get(cur.parentId);
  }

  return null;
}


interface AtlasNodeData extends Record<string, unknown> {
  archNode: ArchitectureNode;
  palette: Palette;
  hasChildren: boolean;
  expanded: boolean;
  childCount: number;
  onToggle: (id: string) => void;
}


const AtlasNode = memo(function AtlasNode({ id, data, selected }: NodeProps) {

  const d = data as AtlasNodeData;
  const { archNode, palette, hasChildren, expanded, childCount, onToggle } = d;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: palette.bg,
        border: `1.5px solid ${palette.border}`,
        borderRadius: 8,
        boxShadow: selected ? `0 0 0 2px ${palette.border}` : undefined,
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(id); }}
          aria-label={expanded ? 'collapse' : 'expand'}
          className="flex items-center justify-center text-[11px] font-bold transition-colors hover:opacity-100"
          style={{
            width: 22,
            borderRight: `1px solid ${palette.border}`,
            color: palette.text,
            opacity: 0.85,
            cursor: 'pointer',
            background: 'transparent',
          }}
        >
          {expanded ? '−' : '+'}
        </button>
      )}
      <div className="flex flex-col items-start gap-0.5 px-2 py-1 flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wider truncate w-full" style={{ color: palette.text, opacity: 0.7 }}>
          {archNode.type}{hasChildren && !expanded ? ` · ${childCount}` : ''}
        </span>
        <span className="text-xs font-medium truncate w-full" style={{ color: palette.text }}>
          {archNode.name}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});


const nodeTypes = { atlas: AtlasNode };


function layoutGraph(
  visible: ArchitectureNode[],
  visibleEdges: ArchitectureEdge[],
): Map<string, { x: number; y: number }> {

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  visible.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  visibleEdges.forEach((e) => g.setEdge(e.fromNodeId, e.toNodeId));

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  visible.forEach((n) => {
    const p = g.node(n.id);
    positions.set(n.id, { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 });
  });

  return positions;
}


export function ArchitectureMapCanvas({ projectId, nodes: archNodes, edges: archEdges, dict }: Props) {

  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const focusPath = searchParams?.get('file') ?? null;

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {

    if (!isFullscreen) return;

    const onKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const hierarchy = useMemo(() => buildHierarchy(archNodes), [archNodes]);

  const palette = useMemo(() => theme === 'light'
    ? {
        types: TYPE_COLORS_LIGHT,
        fallback: DEFAULT_LIGHT,
        edgeStroke: 'rgba(17,24,39,0.45)',
        edgeLabel: '#374151',
        gridColor: 'rgba(17,24,39,0.1)',
        canvasBg: '#ffffff',
      }
    : {
        types: TYPE_COLORS_DARK,
        fallback: DEFAULT_DARK,
        edgeStroke: 'rgba(255,255,255,0.25)',
        edgeLabel: '#9ca3af',
        gridColor: 'rgba(255,255,255,0.06)',
        canvasBg: 'rgba(0,0,0,0.2)',
      },
  [theme]);

  const handleToggle = useCallback((id: string) => {

    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  useEffect(() => {

    if (!focusPath) return;

    const target = archNodes.find((n) => n.path === focusPath);

    if (!target) return;

    setExpanded((prev) => {
      const next = new Set(prev);
      let cur = hierarchy.get(target.id);

      while (cur?.parentId) {
        next.add(cur.parentId);
        cur = hierarchy.get(cur.parentId);
      }

      return next;
    });
    setSelectedNodeId(target.id);
  }, [focusPath, archNodes, hierarchy]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const availableTypes = useMemo(
    () => Array.from(new Set(archNodes.map((n) => n.type))).sort(),
    [archNodes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return archNodes.filter((n) => {

      if (typeFilter !== 'all' && n.type !== typeFilter) return false;

      if (q && !(n.name.toLowerCase().includes(q) || (n.path?.toLowerCase().includes(q) ?? false))) {
        return false;
      }

      return true;
    });
  }, [archNodes, query, typeFilter]);

  const { rfNodes, rfEdges } = useMemo(() => {

    const filteredIds = new Set(filtered.map((n) => n.id));
    const visible = filtered.filter((n) => isVisible(n.id, hierarchy, expanded));
    const visibleIds = new Set(visible.map((n) => n.id));

    const promotedEdges = new Map<string, ArchitectureEdge>();

    for (const e of archEdges) {

      if (!filteredIds.has(e.fromNodeId) || !filteredIds.has(e.toNodeId)) continue;

      const from = visibleIds.has(e.fromNodeId)
        ? e.fromNodeId
        : nearestVisibleAncestor(e.fromNodeId, hierarchy, expanded);
      const to = visibleIds.has(e.toNodeId)
        ? e.toNodeId
        : nearestVisibleAncestor(e.toNodeId, hierarchy, expanded);

      if (!from || !to || from === to) continue;
      if (!visibleIds.has(from) || !visibleIds.has(to)) continue;

      const key = `${from}->${to}:${e.edgeType}`;

      if (!promotedEdges.has(key)) {
        promotedEdges.set(key, { ...e, id: key, fromNodeId: from, toNodeId: to });
      }
    }

    const positions = layoutGraph(visible, Array.from(promotedEdges.values()));

    const rfNodes: Node[] = visible.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const colors = palette.types[n.type] ?? palette.fallback;
      const h = hierarchy.get(n.id);
      const visibleChildCount = (h?.childIds ?? []).filter((cid) => filteredIds.has(cid)).length;

      const data: AtlasNodeData = {
        archNode: n,
        palette: colors,
        hasChildren: visibleChildCount > 0,
        expanded: expanded.has(n.id),
        childCount: visibleChildCount,
        onToggle: handleToggle,
      };

      return {
        id: n.id,
        type: 'atlas',
        position: pos,
        data,
      };
    });

    const rfEdges: Edge[] = Array.from(promotedEdges.values()).map((e) => ({
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      label: e.edgeType === 'depends_on' ? undefined : e.edgeType,
      animated: e.edgeType === 'depends_on',
      style: { stroke: palette.edgeStroke, strokeWidth: 1.2 },
      labelStyle: { fontSize: 10, fill: palette.edgeLabel },
    }));

    return { rfNodes, rfEdges };
  }, [filtered, archEdges, hierarchy, expanded, palette, handleToggle]);

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
        <button
          type="button"
          onClick={() => setExpanded(new Set(Array.from(hierarchy.values()).filter((h) => h.childIds.length > 0).map((h) => h.node.id)))}
          className="px-2 py-1 text-[11px] rounded-md transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
        >
          Espandi tutto
        </button>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          className="px-2 py-1 text-[11px] rounded-md transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
        >
          Comprimi tutto
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
          title={isFullscreen ? 'Esci da schermo intero (Esc)' : 'Schermo intero'}
          className="px-2 py-1 text-[11px] rounded-md transition-colors ml-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
        >
          {isFullscreen ? '⤓ Riduci' : '⤢ Schermo intero'}
        </button>
      </div>

      <div
        className={isFullscreen ? 'fixed inset-0 z-50' : 'rounded-xl overflow-hidden relative'}
        style={
          isFullscreen
            ? { background: palette.canvasBg }
            : { border: '1px solid var(--border-soft)', height: 560, background: palette.canvasBg }
        }
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label="Esci da schermo intero"
            title="Esci da schermo intero (Esc)"
            className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs rounded-md transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
          >
            ⤓ Riduci
          </button>
        )}
        {rfNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            {dict.noNodes}
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
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
