'use client';

import { useState, useTransition } from 'react';
import type { DomainGroup } from '@/lib/api';
import {
  assignNodeToDomainGroupAction,
  createDomainGroupAction,
  deleteDomainGroupAction,
  updateDomainGroupAction,
} from './actions';


const DEFAULT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];


interface DomainGroupsDict {
  title: string;
  addGroup: string;
  namePlaceholder: string;
  colorPlaceholder: string;
  create: string;
  creating: string;
  rename: string;
  delete: string;
  confirmDelete: (name: string) => string;
  noGroups: string;
  assignGroup: string;
  unassign: string;
  assignedTo: (name: string) => string;
  legendTitle: string;
}


interface Props {
  projectId: string;
  groups: DomainGroup[];
  selectedNodeId?: string | null;
  selectedNodeGroupId?: string | null;
  dict: DomainGroupsDict;
  onGroupsChange?: () => void;
}


export function DomainGroupsPanel({
  projectId,
  groups,
  selectedNodeId,
  selectedNodeGroupId,
  dict,
  onGroupsChange,
}: Props) {

  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = () => {

    if (!newName.trim()) return;

    startTransition(async () => {
      await createDomainGroupAction(projectId, { name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(DEFAULT_COLORS[0]);
      setShowCreate(false);
      onGroupsChange?.();
    });
  };

  const handleRename = (id: string) => {

    if (!editName.trim()) return;

    startTransition(async () => {
      await updateDomainGroupAction(projectId, id, { name: editName.trim() });
      setEditingId(null);
      onGroupsChange?.();
    });
  };

  const handleDelete = (group: DomainGroup) => {

    if (!confirm(dict.confirmDelete(group.name))) return;

    startTransition(async () => {
      await deleteDomainGroupAction(projectId, group.id);
      onGroupsChange?.();
    });
  };

  const handleAssign = (groupId: string | null) => {

    if (!selectedNodeId) return;

    startTransition(async () => {
      await assignNodeToDomainGroupAction(projectId, selectedNodeId, groupId);
      onGroupsChange?.();
    });
  };

  return (
    <div
      className="rounded-xl p-3 space-y-2 text-xs"
      style={{ border: '1px solid var(--border-soft)', background: 'var(--surface)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {dict.title}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded transition-colors"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border-soft)' }}
        >
          {dict.addGroup}
        </button>
      </div>

      {showCreate && (
        <div className="flex gap-1 items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={dict.namePlaceholder}
            className="flex-1 px-2 py-1 rounded text-xs focus:outline-none"
            style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <div className="flex gap-1">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full transition-transform"
                style={{
                  background: c,
                  outline: newColor === c ? `2px solid white` : 'none',
                  outlineOffset: 1,
                }}
                aria-label={c}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !newName.trim()}
            className="px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-50"
            style={{ background: '#6366f1', color: 'white' }}
          >
            {isPending ? dict.creating : dict.create}
          </button>
        </div>
      )}

      {groups.length === 0 && !showCreate && (
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{dict.noGroups}</p>
      )}

      <div className="space-y-1">
        {groups.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ background: 'var(--surface-overlay)' }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: g.color ?? '#6b7280' }}
            />
            {editingId === g.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-1 py-0.5 rounded text-xs focus:outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(g.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
              />
            ) : (
              <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>{g.name}</span>
            )}
            <div className="flex gap-1">
              {selectedNodeId && (
                <button
                  type="button"
                  onClick={() => handleAssign(selectedNodeGroupId === g.id ? null : g.id)}
                  disabled={isPending}
                  className="text-[9px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                  style={{
                    background: selectedNodeGroupId === g.id ? '#6366f1' : 'var(--surface)',
                    color: selectedNodeGroupId === g.id ? 'white' : 'var(--text)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  {selectedNodeGroupId === g.id ? '✓' : '+'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingId(g.id);
                  setEditName(g.name);
                }}
                className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)', background: 'transparent' }}
                aria-label={dict.rename}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                disabled={isPending}
                className="text-[9px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                style={{ color: '#ef4444', background: 'transparent' }}
                aria-label={dict.delete}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
