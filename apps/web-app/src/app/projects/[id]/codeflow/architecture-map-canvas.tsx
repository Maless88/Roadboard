'use client';

import { useMemo, useState, useCallback, useEffect, useRef, memo, useTransition } from 'react';
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
  type ReactFlowInstance,
  type OnNodeDrag,
} from '@xyflow/react';
import dagre from 'dagre';
import type { ArchitectureNode, ArchitectureEdge, DomainGroup } from '@/lib/api';
import { NodeDrawer } from './node-drawer';
import { DomainGroupsPanel } from './domain-groups-panel';
import { useTheme } from '@/lib/theme-context';
import { useDict } from '@/lib/i18n/locale-context';
import { assignNodeToDomainGroupAction } from './actions';

import '@xyflow/react/dist/style.css';


interface CanvasDict {
  searchPlaceholder: string;
  filterAll: string;
  noNodes: string;
  decisionAware: {
    toggle: string;
    empty: string;
    nodeBadge: string;
  };
}


interface Props {
  projectId: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  domainGroups: DomainGroup[];
  dict: CanvasDict;
}


const NODE_WIDTH = 130;
const NODE_HEIGHT = 50;


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
  groupColor: string | null;
  hasChildren: boolean;
  expanded: boolean;
  childCount: number;
  onToggle: (id: string) => void;
  decisionCount: number;
  decisionBadgeLabel: string;
}


const AtlasNode = memo(function AtlasNode({ id, data, selected }: NodeProps) {

  const d = data as AtlasNodeData;
  const { archNode, palette, groupColor, hasChildren, expanded, childCount, onToggle, decisionCount, decisionBadgeLabel } = d;

  const borderColor = groupColor ?? palette.border;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: palette.bg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: selected ? `0 0 0 2px ${borderColor}` : undefined,
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {groupColor && (
        <div
          style={{
            width: 4,
            borderRadius: '8px 0 0 8px',
            background: groupColor,
            flexShrink: 0,
          }}
        />
      )}
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
      {decisionCount > 0 && (
        <div
          title={decisionBadgeLabel}
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            background: '#6366f1',
            color: '#fff',
            borderRadius: 9999,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            padding: '2px 5px',
            minWidth: 16,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {decisionCount}
        </div>
      )}
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


// Drop zone refs keyed by group id
type DropZoneRefs = Record<string, HTMLDivElement | null>;


export function ArchitectureMapCanvas({ projectId, nodes: archNodes, edges: archEdges, domainGroups: initialGroups, dict }: Props) {

  const fullDict = useDict();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const focusPath = searchParams?.get('file') ?? null;
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [decisionAwareMode, setDecisionAwareMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [groups, setGroups] = useState(initialGroups);

  // nodeGroupMap: populated from server data (archNode.domainGroup)
  const [nodeGroupMap, setNodeGroupMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};

    for (const n of archNodes) {
      m[n.id] = n.domainGroup ?? null;
    }

    return m;
  });

  const [showGroupPanel, setShowGroupPanel] = useState(false);

  // Drag state
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const dropZoneRefs = useRef<DropZoneRefs>({});
  const dragInProgress = useRef(false);

  // Original layout positions for reset after drag
  const layoutPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Build group color lookup
  const groupColorMap = useMemo(() => {
    const m: Record<string, string> = {};

    for (const g of groups) {
      if (g.color) m[g.id] = g.color;
    }

    return m;
  }, [groups]);

  // Reload groups from server after mutations
  const handleGroupsChange = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/domain-groups?projectId=${projectId}`);

        if (res.ok) {
          const data = await res.json() as typeof initialGroups;
          setGroups(data);
        }
      } catch {
        // silently ignore; stale data tolerated until next page load
      }
    });
  }, [projectId, startTransition]);

  const selectedNodeGroupId = selectedNodeId ? (nodeGroupMap[selectedNodeId] ?? null) : null;

  // Sync nodeGroupMap when archNodes change (e.g. after server revalidation)
  useEffect(() => {
    setNodeGroupMap((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const n of archNodes) {
        const incoming = n.domainGroup ?? null;

        if (next[n.id] !== incoming) {
          next[n.id] = incoming;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [archNodes]);

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

  useEffect(() => {

    if (!rfInstance) return;

    const raf = requestAnimationFrame(() => {
      rfInstance.fitView({ padding: 0.15, duration: 200 });
    });

    return () => cancelAnimationFrame(raf);
  }, [isFullscreen, rfInstance]);

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
    setShowGroupPanel(true);
  }, []);

  // --- Drag-drop handlers ---

  // Find which drop zone (group) is under the given screen coordinates
  const findGroupAtScreenPoint = useCallback((clientX: number, clientY: number): string | null => {
    for (const [groupId, el] of Object.entries(dropZoneRefs.current)) {

      if (!el) continue;

      const rect = el.getBoundingClientRect();

      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return groupId;
      }
    }

    return null;
  }, []);

  const handleNodeDrag: OnNodeDrag = useCallback((_event, node) => {

    if (!rfInstance) return;

    // Convert flow position to screen coordinates (center of node)
    const screenPos = rfInstance.flowToScreenPosition({
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y + NODE_HEIGHT / 2,
    });

    const hoveredGroupId = findGroupAtScreenPoint(screenPos.x, screenPos.y);
    setDragOverGroupId(hoveredGroupId);
  }, [rfInstance, findGroupAtScreenPoint]);

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {

    dragInProgress.current = false;
    setDragOverGroupId(null);

    if (!rfInstance) return;

    const screenPos = rfInstance.flowToScreenPosition({
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y + NODE_HEIGHT / 2,
    });

    const targetGroupId = findGroupAtScreenPoint(screenPos.x, screenPos.y);

    // Reset node to original layout position
    const originalPos = layoutPositionsRef.current.get(node.id);

    if (originalPos) {
      rfInstance.setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: originalPos } : n,
        ),
      );
    }

    if (!targetGroupId) return;

    // Same group → no-op
    const currentGroupId = nodeGroupMap[node.id] ?? null;

    if (currentGroupId === targetGroupId) return;

    // Optimistic update
    setNodeGroupMap((prev) => ({ ...prev, [node.id]: targetGroupId }));

    // Server action
    startTransition(async () => {
      const result = await assignNodeToDomainGroupAction(projectId, node.id, targetGroupId);

      if (result.error) {
        // Rollback
        setNodeGroupMap((prev) => ({ ...prev, [node.id]: currentGroupId }));

        // Toast fallback — use native alert if no toast system available
        console.error('assignNodeToDomainGroup error:', result.error);
      }
    });
  }, [rfInstance, findGroupAtScreenPoint, nodeGroupMap, projectId, startTransition]);

  const handleNodeDragStart: OnNodeDrag = useCallback(() => {
    dragInProgress.current = true;
  }, []);

  // ---

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

      if (decisionAwareMode && n.decisionCount === 0) return false;

      return true;
    });
  }, [archNodes, query, typeFilter, decisionAwareMode]);

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

    // Store layout positions for drag reset
    layoutPositionsRef.current = positions;

    const rfNodes: Node[] = visible.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const colors = palette.types[n.type] ?? palette.fallback;
      const h = hierarchy.get(n.id);
      const visibleChildCount = (h?.childIds ?? []).filter((cid) => filteredIds.has(cid)).length;
      const gid = nodeGroupMap[n.id] ?? null;
      const groupColor = gid ? (groupColorMap[gid] ?? null) : null;

      const data: AtlasNodeData = {
        archNode: n,
        palette: colors,
        groupColor,
        hasChildren: visibleChildCount > 0,
        expanded: expanded.has(n.id),
        childCount: visibleChildCount,
        onToggle: handleToggle,
        decisionCount: n.decisionCount,
        decisionBadgeLabel: dict.decisionAware.nodeBadge.replace('{n}', String(n.decisionCount)),
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
  }, [filtered, archEdges, hierarchy, expanded, palette, handleToggle, nodeGroupMap, groupColorMap]);

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
          onClick={() => setDecisionAwareMode((v) => !v)}
          aria-pressed={decisionAwareMode}
          className="px-2 py-1 text-[11px] rounded-md transition-colors"
          style={{
            background: decisionAwareMode ? '#6366f1' : 'var(--surface)',
            border: `1px solid ${decisionAwareMode ? '#6366f1' : 'var(--border-soft)'}`,
            color: decisionAwareMode ? '#fff' : 'var(--text)',
          }}
        >
          {dict.decisionAware.toggle}
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          aria-label={isFullscreen ? fullDict.codeflow.exitFullscreenLabel : fullDict.codeflow.fullscreenLabel}
          title={isFullscreen ? fullDict.codeflow.exitFullscreenTooltip : fullDict.codeflow.fullscreenTooltip}
          className="px-2 py-1 text-[11px] rounded-md transition-colors ml-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
        >
          {isFullscreen ? fullDict.codeflow.exitFullscreen : fullDict.codeflow.fullscreen}
        </button>
      </div>

      <div
        className={isFullscreen ? 'fixed inset-0 z-50' : 'rounded-xl overflow-hidden relative'}
        style={
          isFullscreen
            ? { background: 'var(--bg)' }
            : { border: '1px solid var(--border-soft)', height: 560, background: palette.canvasBg }
        }
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label={fullDict.codeflow.exitFullscreenLabel}
            title={fullDict.codeflow.exitFullscreenTooltip}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs rounded-md transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
          >
            {fullDict.codeflow.exitFullscreen}
          </button>
        )}

        {/* Drop zones overlay — visible during drag */}
        {groups.length > 0 && (
          <div
            className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 pointer-events-none"
            aria-hidden="true"
          >
            {groups.map((g) => {
              const isActive = dragOverGroupId === g.id;
              const color = g.color ?? '#6b7280';

              return (
                <div
                  key={g.id}
                  ref={(el) => { dropZoneRefs.current[g.id] = el; }}
                  className="pointer-events-none flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-all duration-150"
                  style={{
                    background: isActive ? color : `${color}22`,
                    border: `1.5px solid ${color}`,
                    color: isActive ? '#fff' : color,
                    minWidth: 110,
                    opacity: dragInProgress.current || isActive ? 1 : 0.55,
                    boxShadow: isActive ? `0 0 0 3px ${color}55` : undefined,
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="truncate">{g.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {rfNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            {decisionAwareMode ? dict.decisionAware.empty : dict.noNodes}
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={handleNodeClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
          >
            <Background color={palette.gridColor} gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      <div className="flex gap-3 items-start">
        {/* Legend */}
        {groups.length > 0 && (
          <div
            className="rounded-xl p-3 space-y-1.5 text-xs flex-shrink-0"
            style={{ border: '1px solid var(--border-soft)', background: 'var(--surface)', minWidth: 140 }}
          >
            <span className="font-medium text-[10px] uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
              {fullDict.codeflow.domainGroups.legendTitle}
            </span>
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color ?? '#6b7280' }} />
                <span className="truncate text-[11px]" style={{ color: 'var(--text)' }}>{g.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Domain groups management panel */}
        {showGroupPanel && (
          <div className="flex-1">
            <DomainGroupsPanel
              projectId={projectId}
              groups={groups}
              selectedNodeId={selectedNodeId}
              selectedNodeGroupId={selectedNodeGroupId}
              dict={fullDict.codeflow.domainGroups}
              onGroupsChange={handleGroupsChange}
            />
            <button
              type="button"
              onClick={() => { setShowGroupPanel(false); setSelectedNodeId(null); }}
              className="mt-1 text-[10px] px-2 py-0.5 rounded transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <NodeDrawer
        projectId={projectId}
        nodeId={selectedNodeId}
        onClose={() => { setSelectedNodeId(null); setShowGroupPanel(false); }}
      />
    </div>
  );
}
