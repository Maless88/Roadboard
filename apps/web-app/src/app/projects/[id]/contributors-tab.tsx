'use client';

import { useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { addDeveloperAction, removeDeveloperAction } from '@/app/settings/actions';
import type { User, Grant } from '@/lib/api';


interface ContributorsTabProps {
  projectId: string;
  currentUserId: string;
  isOwner: boolean;
  users: User[];
  initialGrants: Grant[];
}


export function ContributorsTab({ projectId, currentUserId, isOwner, users, initialGrants }: ContributorsTabProps) {

  const dict = useDict();
  const [grants, setGrants] = useState(initialGrants);
  const [addUserId, setAddUserId] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [error, setError] = useState('');

  const ownerGrant = grants.find((g) => g.subjectType === 'user' && g.grantType === 'project.admin');
  const ownerUser = ownerGrant ? users.find((u) => u.id === ownerGrant.subjectId) : null;

  const developerGrants = grants.filter((g) => g.subjectType === 'user' && g.grantType === 'project.write');
  const developerIds = new Set(developerGrants.map((g) => g.subjectId));

  const addableUsers = users.filter(
    (u) => u.id !== ownerGrant?.subjectId && !developerIds.has(u.id),
  );

  async function handleAdd() {

    if (!addUserId) return;

    setAddPending(true);
    setError('');

    const res = await addDeveloperAction(projectId, addUserId);

    if (res.error) {
      setError(res.error);
    } else {
      const now = new Date().toISOString();
      setGrants((prev) => [
        ...prev,
        { id: `tmp-pw-${addUserId}`, projectId, subjectType: 'user', subjectId: addUserId, grantType: 'project.write', grantedByUserId: null, createdAt: now },
        { id: `tmp-tw-${addUserId}`, projectId, subjectType: 'user', subjectId: addUserId, grantType: 'task.write', grantedByUserId: null, createdAt: now },
      ]);
      setAddUserId('');
    }

    setAddPending(false);
  }

  async function handleRemove(userId: string) {

    const res = await removeDeveloperAction(projectId, userId);

    if (res.error) {
      setError(res.error);
    } else {
      setGrants((prev) =>
        prev.filter((g) => !(g.subjectType === 'user' && g.subjectId === userId && g.grantType !== 'project.admin')),
      );
    }
  }

  return (
    <div className="space-y-5">

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {error}
        </div>
      )}

      <Card title={dict.settings.members.owner}>
        {ownerUser ? (
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-white font-medium">{ownerUser.displayName}</p>
              <p className="text-xs text-gray-500 mt-0.5">@{ownerUser.username}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
              {dict.settings.members.owner}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{dict.settings.members.noOwner}</p>
        )}
      </Card>

      <Card title={dict.settings.members.developers}>
        {developerGrants.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">{dict.settings.members.noDevelopers}</p>
        ) : (
          <div className="divide-y divide-white/[0.06] mb-4">
            {developerGrants.map((g) => {

              const dev = users.find((u) => u.id === g.subjectId);

              if (!dev) return null;

              const isSelf = dev.id === currentUserId;
              const canRemoveThis = isOwner || isSelf;

              return (
                <div key={g.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="text-sm text-white font-medium">
                      {dev.displayName}
                      {isSelf && <span className="ml-2 text-xs text-indigo-400">({dict.settings.members.you})</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">@{dev.username}</p>
                  </div>
                  {canRemoveThis && (
                    <button
                      onClick={() => void handleRemove(dev.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {isSelf ? dict.settings.members.leave : dict.settings.members.remove}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isOwner && addableUsers.length > 0 && (
          <div className="flex gap-2 items-center">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}
            >
              <option value="" style={{ background: 'var(--surface-overlay)', color: 'var(--text)' }}>{dict.settings.members.selectUser}</option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id} style={{ background: 'var(--surface-overlay)', color: 'var(--text)' }}>
                  {u.displayName} (@{u.username})
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleAdd()}
              disabled={addPending || !addUserId}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addPending ? '…' : dict.settings.members.addButton}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}


function Card({ title, children }: { title?: string; children: React.ReactNode }) {

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}
