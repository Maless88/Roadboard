'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import type { SessionInfo, McpTokenInfo, User, Grant, Project } from '@/lib/api';
import { useDict } from '@/lib/i18n/locale-context';
import {
  changePasswordAction,
  createTokenAction,
  revokeTokenAction,
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  addDeveloperAction,
  removeDeveloperAction,
} from './actions';


interface Props {
  session: SessionInfo;
  tokens: McpTokenInfo[];
  users: User[];
  projects: Project[];
  grantsPerProject: { project: Project; grants: Grant[] }[];
  isAdmin: boolean;
  isTeamLeader: boolean;
}


type TabKey = 'security' | 'tokens' | 'users' | 'members';


function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {

  const base = 'rounded-lg px-4 py-3 text-sm';
  const cls = type === 'error' ? `${base} text-red-400` : `${base} text-green-400`;
  const style = type === 'error'
    ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
    : { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' };

  return <div className={cls} style={style}>{msg}</div>;
}


function Field({ label, name, type = 'text', placeholder, required = true }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean;
}) {

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
    </div>
  );
}


function SubmitBtn({ pending, label, pendingLabel }: {
  pending: boolean; label: string; pendingLabel: string;
}) {

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}


function Card({ title, children }: { title?: string; children: React.ReactNode }) {

  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}


function SecurityTab() {

  const dict = useDict();
  const [state, action, pending] = useActionState(changePasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {

    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Card title={dict.settings.security.title}>
      <form ref={formRef} action={action} className="space-y-4 max-w-sm">
        {state.error && <Alert type="error" msg={state.error} />}
        {state.success && <Alert type="success" msg={dict.settings.security.success} />}
        <Field label={dict.settings.security.currentPassword} name="currentPassword" type="password" />
        <Field label={dict.settings.security.newPassword} name="newPassword" type="password" placeholder="min. 8 caratteri" />
        <Field label={dict.settings.security.confirmPassword} name="confirmPassword" type="password" />
        <SubmitBtn pending={pending} label={dict.settings.security.updateButton} pendingLabel={dict.settings.security.updating} />
      </form>
    </Card>
  );
}


const MCP_TOKEN_SCOPES: { value: string; defaultChecked: boolean }[] = [
  { value: 'project.read', defaultChecked: true },
  { value: 'project.write', defaultChecked: true },
  { value: 'task.write', defaultChecked: true },
  { value: 'memory.write', defaultChecked: true },
  { value: 'decision.write', defaultChecked: true },
  { value: 'dashboard.read', defaultChecked: true },
  { value: 'token.manage', defaultChecked: false },
  { value: 'project.admin', defaultChecked: false },
  { value: 'codeflow.read', defaultChecked: false },
  { value: 'codeflow.write', defaultChecked: false },
  { value: 'codeflow.scan', defaultChecked: false },
];


function TokensTab({ session, initialTokens }: { session: SessionInfo; initialTokens: McpTokenInfo[] }) {

  const dict = useDict();
  const [tokens, setTokens] = useState(initialTokens);
  const [createState, createAction, createPending] = useActionState(createTokenAction, {});
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {

    if (createState.created) {
      setNewToken(createState.created.token);
      setCopied(false);
      formRef.current?.reset();
    }
  }, [createState.created]);

  async function handleRevoke(tokenId: string) {

    await revokeTokenAction(tokenId);
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  }

  function handleCopy() {

    if (!newToken) return;

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(newToken);
    } else {
      const el = document.createElement('textarea');
      el.value = newToken;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }

    setCopied(true);
  }

  const active = tokens.filter((t) => t.status === 'active');

  return (
    <div className="space-y-5">

      {newToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl" style={{ background: 'rgba(13,13,20,0.97)', border: '1px solid rgba(34,197,94,0.25)', backdropFilter: 'blur(20px)' }}>
            <h3 className="text-sm font-semibold text-green-400 mb-1">{dict.settings.tokens.createdTitle}</h3>
            <p className="text-xs text-gray-400 mb-4">{dict.settings.tokens.createdWarning}</p>
            <code className="block rounded-lg px-4 py-3 text-green-400 font-mono text-xs break-all leading-relaxed" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,197,94,0.15)' }}>
              {newToken}
            </code>
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={handleCopy}
                className="rounded-md bg-green-700 hover:bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {copied ? dict.settings.tokens.copied : dict.settings.tokens.copy}
              </button>
              <button
                onClick={() => setNewToken(null)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {dict.settings.tokens.close}
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title={dict.settings.tokens.title}>
        {active.length === 0 ? (
          <p className="text-sm text-gray-500">{dict.settings.tokens.noTokens}</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {active.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-white font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    scopes: <span className="text-gray-400">{t.scopes.join(', ')}</span>
                    {' · '}
                    {new Date(t.createdAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <button
                  onClick={() => void handleRevoke(t.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {dict.settings.tokens.revoke}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={dict.settings.tokens.createTitle}>
        <form ref={formRef} action={createAction} className="space-y-4 max-w-sm">
          {createState.error && <Alert type="error" msg={createState.error} />}
          <input type="hidden" name="userId" value={session.userId} />
          <Field label="Nome" name="name" placeholder="es. claude-local" />
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium">Scopes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {MCP_TOKEN_SCOPES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s.value}
                    defaultChecked={s.defaultChecked}
                    className="rounded border-white/20 bg-black/30"
                  />
                  <span>{s.value}</span>
                </label>
              ))}
            </div>
          </div>
          <SubmitBtn pending={createPending} label={dict.settings.tokens.createButton} pendingLabel={dict.settings.tokens.creating} />
        </form>
      </Card>

      <Card>
        <p className="text-xs text-gray-500 leading-relaxed">
          Usa il token generato per configurare il tuo client MCP.{' '}
          <a href="/mcp-guide" className="text-indigo-400 hover:text-indigo-300 underline">
            Guida alla configurazione →
          </a>
        </p>
      </Card>
    </div>
  );
}


const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  team_leader: 'Team Leader',
  developer: 'Developer',
  guest: 'Guest',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  team_leader: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  developer: 'text-green-400 bg-green-500/10 border-green-500/20',
  guest: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};


function RoleBadge({ role }: { role: string }) {

  const cls = ROLE_COLORS[role] ?? ROLE_COLORS.guest;

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}


function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {

  const dict = useDict();
  const [state, action, pending] = useActionState(resetUserPasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {

    if (state.success) {
      formRef.current?.reset();
      setTimeout(onClose, 800);
    }
  }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl" style={{ background: 'rgba(13,13,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
        <h3 className="text-sm font-semibold text-white mb-1">{dict.settings.users.resetTitle}</h3>
        <p className="text-xs text-gray-400 mb-4">
          Imposta una nuova password per <strong className="text-white">{user.displayName}</strong>
        </p>
        <form ref={formRef} action={action} className="space-y-4">
          {state.error && <Alert type="error" msg={state.error} />}
          {state.success && <Alert type="success" msg={dict.settings.users.resetSuccess} />}
          <input type="hidden" name="userId" value={user.id} />
          <Field label={dict.settings.users.newPasswordPlaceholder} name="newPassword" type="password" placeholder="min. 8 caratteri" />
          <div className="flex gap-3">
            <SubmitBtn pending={pending} label={dict.settings.users.resetButton} pendingLabel={dict.settings.users.resetting} />
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {dict.forms.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function UsersTab({
  currentUserId,
  initialUsers,
  isAdmin,
}: {
  currentUserId: string;
  initialUsers: User[];
  isAdmin: boolean;
}) {

  const dict = useDict();
  const [users, setUsers] = useState(initialUsers);
  const [createState, createAction, createPending] = useActionState(createUserAction, {});
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {

    if (createState.success) formRef.current?.reset();
  }, [createState.success]);

  async function handleDelete(userId: string) {

    await deleteUserAction(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  return (
    <div className="space-y-5">
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      <Card title={dict.settings.users.title}>
        <div className="divide-y divide-white/[0.06]">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-white font-medium">{u.displayName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">@{u.username} · {u.email}</p>
                </div>
                <RoleBadge role={u.role} />
              </div>
              {u.id !== currentUserId && (
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={() => setResetTarget(u)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {dict.settings.users.resetPwd}
                    </button>
                  )}
                  <button
                    onClick={() => void handleDelete(u.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    {dict.settings.users.delete}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title={dict.settings.users.createTitle}>
        <form ref={formRef} action={createAction} className="space-y-4 max-w-sm">
          {createState.error && <Alert type="error" msg={createState.error} />}
          {createState.success && <Alert type="success" msg={dict.settings.users.success} />}
          <Field label="Username" name="username" placeholder="es. mario" />
          <Field label={dict.settings.users.displayNamePlaceholder} name="displayName" placeholder="es. Mario Rossi" />
          <Field label="Email" name="email" type="email" placeholder="mario@esempio.it" />
          <Field label="Password iniziale" name="password" type="password" placeholder="min. 8 caratteri" />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ruolo</label>
            <select
              name="role"
              defaultValue="developer"
              className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{ background: '#1e2030', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isAdmin && <option value="admin" style={{ background: '#1e2030', color: '#fff' }}>Admin</option>}
              {isAdmin && <option value="team_leader" style={{ background: '#1e2030', color: '#fff' }}>Team Leader</option>}
              <option value="developer" style={{ background: '#1e2030', color: '#fff' }}>Developer</option>
              <option value="guest" style={{ background: '#1e2030', color: '#fff' }}>Guest</option>
            </select>
          </div>
          <SubmitBtn pending={createPending} label={dict.settings.users.createButton} pendingLabel={dict.settings.users.creating} />
        </form>
      </Card>
    </div>
  );
}


function MembriTab({
  users,
  grantsPerProject,
}: {
  users: User[];
  grantsPerProject: { project: Project; grants: Grant[] }[];
}) {

  const dict = useDict();
  const [selectedId, setSelectedId] = useState(grantsPerProject[0]?.project.id ?? '');
  const [localGrantsPerProject, setLocalGrantsPerProject] = useState(grantsPerProject);
  const [addUserId, setAddUserId] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [error, setError] = useState('');

  const { project, grants } = localGrantsPerProject.find((pg) => pg.project.id === selectedId)
    ?? { project: grantsPerProject[0]?.project, grants: [] };

  const ownerGrant = grants.find((g) => g.subjectType === 'user' && g.grantType === 'project.admin');
  const ownerUser = ownerGrant ? users.find((u) => u.id === ownerGrant.subjectId) : null;

  const developerGrants = grants.filter((g) => g.subjectType === 'user' && g.grantType === 'project.write');
  const developerIds = new Set(developerGrants.map((g) => g.subjectId));

  const addableUsers = users.filter(
    (u) => u.id !== ownerGrant?.subjectId && !developerIds.has(u.id),
  );

  function updateLocalGrants(projectId: string, updater: (g: Grant[]) => Grant[]) {

    setLocalGrantsPerProject((prev) =>
      prev.map((pg) =>
        pg.project.id === projectId ? { ...pg, grants: updater(pg.grants) } : pg,
      ),
    );
  }

  async function handleAdd() {

    if (!addUserId || !project) return;
    setAddPending(true);
    setError('');

    const res = await addDeveloperAction(project.id, addUserId);

    if (res.error) {
      setError(res.error);
    } else {
      updateLocalGrants(project.id, (prev) => [
        ...prev,
        { id: `tmp-pw-${addUserId}`, projectId: project.id, subjectType: 'user', subjectId: addUserId, grantType: 'project.write', grantedByUserId: null, createdAt: new Date().toISOString() },
        { id: `tmp-tw-${addUserId}`, projectId: project.id, subjectType: 'user', subjectId: addUserId, grantType: 'task.write', grantedByUserId: null, createdAt: new Date().toISOString() },
      ]);
      setAddUserId('');
    }

    setAddPending(false);
  }

  async function handleRemove(userId: string) {

    if (!project) return;
    const res = await removeDeveloperAction(project.id, userId);

    if (res.error) {
      setError(res.error);
    } else {
      updateLocalGrants(project.id, (prev) =>
        prev.filter((g) => !(g.subjectType === 'user' && g.subjectId === userId && g.grantType !== 'project.admin')),
      );
    }
  }

  if (grantsPerProject.length === 0) {
    return <Card><p className="text-sm text-gray-500">{dict.settings.members.noProjects}</p></Card>;
  }

  return (
    <div className="space-y-5">

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{dict.settings.members.title}</label>
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
          className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          style={{ background: '#1e2030', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {grantsPerProject.map(({ project: p }) => (
            <option key={p.id} value={p.id} style={{ background: '#1e2030', color: '#fff' }}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <Alert type="error" msg={error} />}

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
              return (
                <div key={g.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="text-sm text-white font-medium">{dev.displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">@{dev.username}</p>
                  </div>
                  <button
                    onClick={() => void handleRemove(dev.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    {dict.settings.members.remove}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {addableUsers.length > 0 && (
          <div className="flex gap-2 items-center">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{ background: '#1e2030', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="" style={{ background: '#1e2030', color: '#fff' }}>{dict.settings.members.selectUser}</option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#1e2030', color: '#fff' }}>{u.displayName} (@{u.username})</option>
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


export function SettingsTabs({
  session,
  tokens,
  users,
  projects,
  grantsPerProject,
  isAdmin,
  isTeamLeader,
}: Props) {

  const dict = useDict();
  const canManageUsers = isAdmin || isTeamLeader;

  const visibleTabs: { key: TabKey; label: string }[] = [
    { key: 'security', label: dict.settings.tabs.security },
    { key: 'tokens', label: dict.settings.tabs.tokens },
    ...(canManageUsers ? [{ key: 'users' as TabKey, label: dict.settings.tabs.users }] : []),
    ...(isAdmin ? [{ key: 'members' as TabKey, label: dict.settings.tabs.members }] : []),
  ];

  const [active, setActive] = useState<TabKey>('security');

  return (
    <div>
      <div className="flex gap-1 mb-6 rounded-xl p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'security' && <SecurityTab />}
      {active === 'tokens' && <TokensTab session={session} initialTokens={tokens} />}
      {active === 'users' && canManageUsers && (
        <UsersTab currentUserId={session.userId} initialUsers={users} isAdmin={isAdmin} />
      )}
      {active === 'members' && isAdmin && (
        <MembriTab users={users} grantsPerProject={grantsPerProject} />
      )}
    </div>
  );
}
