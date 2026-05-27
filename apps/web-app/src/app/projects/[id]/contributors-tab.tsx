'use client';

import { useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { useToast } from '@/lib/toast-context';
import { withToast } from '@/lib/with-toast';
import { addDeveloperAction, removeDeveloperAction } from '@/app/settings/actions';
import type { User, Grant } from '@/lib/api';
import type { EffectiveContributor, GrantOrigin } from './contributors-effective';


interface ContributorsTabProps {
  projectId: string;
  currentUserId: string;
  isOwner: boolean;
  users: User[];
  initialGrants: Grant[];
  effectiveContributors: EffectiveContributor[];
}


export function ContributorsTab({
  projectId,
  currentUserId,
  isOwner,
  users,
  initialGrants,
  effectiveContributors,
}: ContributorsTabProps) {

  const dict = useDict();
  const { showToast } = useToast();
  const [grants, setGrants] = useState(initialGrants);
  const [addUserId, setAddUserId] = useState('');
  const [addPending, setAddPending] = useState(false);

  const ownerGrant = grants.find((g) => g.subjectType === 'user' && g.grantType === 'project.admin');
  const ownerUser = ownerGrant ? users.find((u) => u.id === ownerGrant.subjectId) : null;

  const developerGrants = grants.filter((g) => g.subjectType === 'user' && g.grantType === 'project.write');
  const developerIds = new Set(developerGrants.map((g) => g.subjectId));

  const addableUsers = users.filter(
    (u) => u.id !== ownerGrant?.subjectId && !developerIds.has(u.id),
  );

  const noAccessContributors = effectiveContributors.filter((ec) => ec.noAccess);

  async function handleAdd() {

    if (!addUserId) return;

    setAddPending(true);

    const res = await withToast(
      () => addDeveloperAction(projectId, addUserId),
      showToast,
      { successMsg: dict.common.toast.added },
    );

    if (!res?.error) {
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

    const res = await withToast(
      () => removeDeveloperAction(projectId, userId),
      showToast,
      { successMsg: dict.common.toast.removed },
    );

    if (!res?.error) {
      setGrants((prev) =>
        prev.filter((g) => !(g.subjectType === 'user' && g.subjectId === userId && g.grantType !== 'project.admin')),
      );
    }
  }

  return (
    <div className="space-y-5">

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
              const ec = effectiveContributors.find((c) => c.userId === dev.id);

              return (
                <div key={g.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium">
                        {dev.displayName}
                        {isSelf && <span className="ml-2 text-xs text-indigo-400">({dict.settings.members.you})</span>}
                      </p>
                      {ec && ec.effectiveGrants.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {ec.effectiveGrants.map((eg, i) => (
                            <GrantBadge key={i} grantType={eg.grantType} origin={eg.origin} dict={dict.settings.members} />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">@{dev.username}</p>
                  </div>
                  {canRemoveThis && (
                    <button
                      onClick={() => void handleRemove(dev.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors ml-3 shrink-0"
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

      {noAccessContributors.length > 0 && (
        <Card title={dict.settings.members.teamMembers}>
          <div className="divide-y divide-white/[0.06]">
            {noAccessContributors.map((ec) => {

              const user = users.find((u) => u.id === ec.userId);

              if (!user) return null;

              return (
                <div key={ec.userId} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="text-sm text-white font-medium">{user.displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">@{user.username}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded border text-orange-400 bg-orange-500/10 border-orange-500/20">
                    {dict.settings.members.noAccess}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}


// ─── Grant badge ─────────────────────────────────────────────────────────────

interface GrantBadgeProps {
  grantType: string;
  origin: GrantOrigin;
  dict: {
    grantOriginDirect: string;
    grantOriginTeamInherited: string;
    grantOriginAdminExpanded: string;
    grantOriginDowngraded: string;
  };
}


function GrantBadge({ grantType, origin, dict }: GrantBadgeProps) {

  const originLabel = originToLabel(origin, dict);

  const colorClass =
    origin === 'direct' || origin === 'admin-expanded'
      ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
      : origin === 'downgraded'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-sky-400 bg-sky-500/10 border-sky-500/20';

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded border font-mono ${colorClass}`}
      title={`${grantType} (${originLabel})`}
    >
      {grantType}
      <span className="ml-1 opacity-60">({originLabel})</span>
    </span>
  );
}


function originToLabel(
  origin: GrantOrigin,
  dict: {
    grantOriginDirect: string;
    grantOriginTeamInherited: string;
    grantOriginAdminExpanded: string;
    grantOriginDowngraded: string;
  },
): string {

  if (origin === 'direct') return dict.grantOriginDirect;

  if (origin === 'team-inherited') return dict.grantOriginTeamInherited;

  if (origin === 'admin-expanded') return dict.grantOriginAdminExpanded;

  return dict.grantOriginDowngraded;
}


// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}
