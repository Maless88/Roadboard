'use client';

import { useEffect, useState } from 'react';
import type { ArchitectureNodeDetail, ArchitectureLink } from '@/lib/api';
import { useDict } from '@/lib/i18n/locale-context';
import { createNodeLinkAction, deleteNodeLinkAction } from './actions';


const ENTITY_TYPES = ['task', 'decision', 'milestone', 'memory_entry'] as const;

const LINK_TYPES = [
  'implements', 'modifies', 'fixes',
  'addresses', 'motivates', 'constrains',
  'delivers', 'describes', 'warns_about',
] as const;


const ENTITY_COLOR: Record<string, string> = {
  task: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  decision: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  milestone: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  memory_entry: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
};


interface DrawerProps {
  projectId: string;
  nodeId: string | null;
  onClose: () => void;
}


type Tab = 'info' | 'decisions' | 'tasks' | 'memory' | 'links';


export function NodeDrawer({ projectId, nodeId, onClose }: DrawerProps) {

  const dict = useDict();
  const [node, setNode] = useState<ArchitectureNodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => {

    if (!nodeId) {
      setNode(null);
      setError(null);
      setTab('info');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/codeflow/nodes/${nodeId}?projectId=${projectId}`)
      .then((r) => r.ok ? r.json() as Promise<ArchitectureNodeDetail> : Promise.reject(new Error(`${r.status}`)))
      .then((data) => { if (!cancelled) setNode(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [nodeId, projectId]);

  if (!nodeId) return null;

  const linksByType = (node?.links ?? []).reduce<Record<string, ArchitectureLink[]>>((acc, l) => {
    (acc[l.entityType] ??= []).push(l);
    return acc;
  }, {});

  const decisions = linksByType.decision ?? [];
  const tasks = linksByType.task ?? [];
  const memory = linksByType.memory_entry ?? [];
  const allLinks = node?.links ?? [];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'info', label: dict.codeflow.drawer.tabInfo, count: node?.annotations.length ?? 0 },
    { key: 'decisions', label: dict.codeflow.drawer.tabDecisions, count: decisions.length },
    { key: 'tasks', label: dict.codeflow.drawer.tabTasks, count: tasks.length },
    { key: 'memory', label: dict.codeflow.drawer.tabMemory, count: memory.length },
    { key: 'links', label: dict.codeflow.drawer.tabLinks, count: allLinks.length },
  ];

  return (
    <div
      className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 flex flex-col"
      style={{
        background: 'var(--surface-strong)',
        borderLeft: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-20px 0 40px rgba(0,0,0,0.18)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="min-w-0 flex-1">
          {loading && <p className="text-xs text-gray-500">{dict.codeflow.drawer.loading}</p>}
          {error && <p className="text-xs text-red-400">{dict.codeflow.drawer.loadError}: {error}</p>}
          {node && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{node.type}</p>
              <h2 className="text-sm font-semibold text-white truncate">{node.name}</h2>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-3 w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label={dict.codeflow.drawer.close}
        >
          ×
        </button>
      </div>

      {node && (
        <nav
          className="flex gap-1 px-3 pt-3"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;

            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'px-3 py-2 text-xs font-medium rounded-t transition-colors',
                  active
                    ? 'text-white border-b-2 border-indigo-500 -mb-px'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1 text-gray-500">({t.count})</span>}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {node && tab === 'info' && <InfoPanel node={node} dict={dict} />}
        {node && tab === 'decisions' && (
          <LinksList
            links={decisions}
            projectId={projectId}
            emptyMsg={dict.codeflow.drawer.noDecisions}
            removeLabel={dict.codeflow.drawer.remove}
          />
        )}
        {node && tab === 'tasks' && (
          <LinksList
            links={tasks}
            projectId={projectId}
            emptyMsg={dict.codeflow.drawer.noTasks}
            removeLabel={dict.codeflow.drawer.remove}
          />
        )}
        {node && tab === 'memory' && (
          <LinksList
            links={memory}
            projectId={projectId}
            emptyMsg={dict.codeflow.drawer.noMemory}
            removeLabel={dict.codeflow.drawer.remove}
          />
        )}
        {node && tab === 'links' && (
          <>
            <LinksList
              links={allLinks}
              projectId={projectId}
              emptyMsg={dict.codeflow.drawer.noLinks}
              removeLabel={dict.codeflow.drawer.remove}
              showEntityBadge
            />
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <CreateLinkForm projectId={projectId} nodeId={node.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function InfoPanel({ node, dict }: { node: ArchitectureNodeDetail; dict: ReturnType<typeof useDict> }) {

  return (
    <div className="space-y-4 text-xs">
      <Row label={dict.codeflow.drawer.type}>{node.type}</Row>
      {node.path && <Row label={dict.codeflow.drawer.path}><code className="font-mono text-gray-400">{node.path}</code></Row>}
      {node.domainGroup && <Row label={dict.codeflow.drawer.domainGroup}>{node.domainGroup}</Row>}
      <Row label={dict.codeflow.drawer.counts}>
        {node.openTaskCount} task · {node.decisionCount} decisioni · {node.annotationCount} annotazioni
      </Row>

      {node.description && (
        <div>
          <p className="text-gray-500 mb-1">Description</p>
          <p className="text-gray-300 leading-relaxed">{node.description}</p>
        </div>
      )}

      <div>
        <p className="text-gray-500 mb-2">{dict.codeflow.drawer.annotations}</p>
        {node.annotations.length === 0 ? (
          <p className="text-gray-600">{dict.codeflow.drawer.noAnnotations}</p>
        ) : (
          <div className="space-y-2">
            {node.annotations.map((a) => (
              <div
                key={a.id}
                className="rounded-md px-3 py-2"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
              >
                <p className="text-gray-300 whitespace-pre-wrap">{a.content}</p>
                <p className="text-gray-600 mt-1">{new Date(a.createdAt).toLocaleString('it-IT')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function Row({ label, children }: { label: string; children: React.ReactNode }) {

  return (
    <div className="flex gap-3">
      <span className="text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-gray-200 min-w-0 break-all">{children}</span>
    </div>
  );
}


function LinksList({
  links,
  projectId,
  emptyMsg,
  removeLabel,
  showEntityBadge = false,
}: {
  links: ArchitectureLink[];
  projectId: string;
  emptyMsg: string;
  removeLabel: string;
  showEntityBadge?: boolean;
}) {

  const [removing, setRemoving] = useState<string | null>(null);
  const [localLinks, setLocalLinks] = useState(links);

  useEffect(() => { setLocalLinks(links); }, [links]);

  async function handleRemove(linkId: string) {

    setRemoving(linkId);
    const res = await deleteNodeLinkAction(projectId, linkId);

    if (!res.error) {
      setLocalLinks((prev) => prev.filter((l) => l.id !== linkId));
    }

    setRemoving(null);
  }

  if (localLinks.length === 0) {
    return <p className="text-xs text-gray-600">{emptyMsg}</p>;
  }

  return (
    <div className="space-y-2">
      {localLinks.map((l) => (
        <div
          key={l.id}
          className="rounded-md px-3 py-2 flex items-start justify-between gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs mb-1">
              {showEntityBadge && (
                <span className={`px-1.5 py-0.5 rounded border ${ENTITY_COLOR[l.entityType] ?? 'bg-gray-700 text-gray-300'}`}>
                  {l.entityType}
                </span>
              )}
              <span className="text-gray-400">{l.linkType}</span>
            </div>
            <p className="text-xs text-gray-200 font-mono truncate">{l.entityId}</p>
            {l.note && <p className="text-xs text-gray-500 mt-1">{l.note}</p>}
          </div>
          <button
            onClick={() => void handleRemove(l.id)}
            disabled={removing === l.id}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            {removing === l.id ? '…' : removeLabel}
          </button>
        </div>
      ))}
    </div>
  );
}


function CreateLinkForm({ projectId, nodeId }: { projectId: string; nodeId: string }) {

  const dict = useDict();
  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0]);
  const [entityId, setEntityId] = useState('');
  const [linkType, setLinkType] = useState<string>(LINK_TYPES[0]);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!entityId.trim()) return;
    setPending(true);
    setError(null);

    const res = await createNodeLinkAction(projectId, nodeId, {
      entityType, entityId: entityId.trim(), linkType, note: note.trim() || undefined,
    });

    if (res.error) {
      setError(res.error);
    } else {
      setEntityId('');
      setNote('');
    }

    setPending(false);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <p className="text-xs text-gray-400 font-medium">{dict.codeflow.drawer.createLink}</p>

      {error && (
        <p className="text-xs text-red-400 rounded-md px-2 py-1" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Select
          label={dict.codeflow.drawer.entityType}
          value={entityType}
          onChange={setEntityType}
          options={ENTITY_TYPES}
        />
        <Select
          label={dict.codeflow.drawer.linkType}
          value={linkType}
          onChange={setLinkType}
          options={LINK_TYPES}
        />
      </div>

      <Input label={dict.codeflow.drawer.entityId} value={entityId} onChange={setEntityId} placeholder="CUID" />
      <Input label={dict.codeflow.drawer.note} value={note} onChange={setNote} />

      <button
        type="submit"
        disabled={pending || !entityId.trim()}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {pending ? dict.codeflow.drawer.creating : dict.codeflow.drawer.createButton}
      </button>
    </form>
  );
}


function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {

  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-0.5 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ background: 'var(--surface-overlay)' }}>{o}</option>
        ))}
      </select>
    </label>
  );
}


function Input({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {

  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-0.5 block">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md px-2 py-1 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}
      />
    </label>
  );
}
