'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import type { SessionInfo, McpTokenInfo, User, Grant, Project } from '@/lib/api';
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


const TABS = ['Sicurezza', 'Token MCP', 'Utenti', 'Membri'] as const;
type Tab = typeof TABS[number];


function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {

  const base = 'rounded-lg px-4 py-3 text-sm';
  const cls = type === 'error'
    ? `${base} text-red-400`
    : `${base} text-green-400`;
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


function SubmitBtn({ pending, label, pendingLabel = 'Salvataggio…' }: {
  pending: boolean; label: string; pendingLabel?: string;
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


/* ── Tab: Sicurezza ── */
function SecurityTab() {

  const [state, action, pending] = useActionState(changePasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {

    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Card title="Cambia password">
      <form ref={formRef} action={action} className="space-y-4 max-w-sm">
        {state.error && <Alert type="error" msg={state.error} />}
        {state.success && <Alert type="success" msg="Password aggiornata con successo." />}
        <Field label="Password attuale" name="currentPassword" type="password" />
        <Field label="Nuova password" name="newPassword" type="password" placeholder="min. 8 caratteri" />
        <Field label="Conferma nuova password" name="confirmPassword" type="password" />
        <SubmitBtn pending={pending} label="Aggiorna password" />
      </form>
    </Card>
  );
}


/* ── Tab: Token MCP ── */
function TokensTab({ session, initialTokens }: { session: SessionInfo; initialTokens: McpTokenInfo[] }) {

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
            <h3 className="text-sm font-semibold text-green-400 mb-1">Token creato</h3>
            <p className="text-xs text-gray-400 mb-4">
              Copialo adesso — non sarà più visibile dopo aver chiuso questa finestra.
            </p>
            <code className="block rounded-lg px-4 py-3 text-green-400 font-mono text-xs break-all leading-relaxed" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,197,94,0.15)' }}>
              {newToken}
            </code>
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={handleCopy}
                className="rounded-md bg-green-700 hover:bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {copied ? 'Copiato!' : 'Copia negli appunti'}
              </button>
              <button
                onClick={() => setNewToken(null)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title="Token attivi">
        {active.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun token attivo.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {active.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-white font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    scope: <span className="text-gray-400">{t.scope}</span>
                    {' · '}
                    {new Date(t.createdAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <button
                  onClick={() => void handleRevoke(t.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Revoca
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Crea nuovo token">
        <form ref={formRef} action={createAction} className="space-y-4 max-w-sm">
          {createState.error && <Alert type="error" msg={createState.error} />}
          <input type="hidden" name="userId" value={session.userId} />
          <Field label="Nome" name="name" placeholder="es. claude-local" />
          <input type="hidden" name="scope" value="read write" />
          <SubmitBtn pending={createPending} label="Crea token" />
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
        <h3 className="text-sm font-semibold text-white mb-1">Reset password</h3>
        <p className="text-xs text-gray-400 mb-4">
          Imposta una nuova password per <strong className="text-white">{user.displayName}</strong>
        </p>
        <form ref={formRef} action={action} className="space-y-4">
          {state.error && <Alert type="error" msg={state.error} />}
          {state.success && <Alert type="success" msg="Password resettata." />}
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Nuova password" name="newPassword" type="password" placeholder="min. 8 caratteri" />
          <div className="flex gap-3">
            <SubmitBtn pending={pending} label="Salva" />
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ── Tab: Utenti ── */
function UsersTab({
  currentUserId,
  initialUsers,
  isAdmin,
}: {
  currentUserId: string;
  initialUsers: User[];
  isAdmin: boolean;
}) {

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

      <Card title="Utenti registrati">
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
                      Reset pwd
                    </button>
                  )}
                  <button
                    onClick={() => void handleDelete(u.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Elimina
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Crea nuovo utente">
        <form ref={formRef} action={createAction} className="space-y-4 max-w-sm">
          {createState.error && <Alert type="error" msg={createState.error} />}
          {createState.success && <Alert type="success" msg="Utente creato." />}
          <Field label="Username" name="username" placeholder="es. mario" />
          <Field label="Nome visualizzato" name="displayName" placeholder="es. Mario Rossi" />
          <Field label="Email" name="email" type="email" placeholder="mario@esempio.it" />
          <Field label="Password iniziale" name="password" type="password" placeholder="min. 8 caratteri" />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ruolo</label>
            <select
              name="role"
              defaultValue="developer"
              className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isAdmin && <option value="admin">Admin</option>}
              {isAdmin && <option value="team_leader">Team Leader</option>}
              <option value="developer">Developer</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          <SubmitBtn pending={createPending} label="Crea utente" />
        </form>
      </Card>
    </div>
  );
}


/* ── Tab: Membri ── */
function MembriTab({
  users,
  grantsPerProject,
}: {
  users: User[];
  grantsPerProject: { project: Project; grants: Grant[] }[];
}) {

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
    return <Card><p className="text-sm text-gray-500">Nessun progetto disponibile.</p></Card>;
  }

  return (
    <div className="space-y-5">

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Progetto</label>
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
          className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {grantsPerProject.map(({ project: p }) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <Alert type="error" msg={error} />}

      <Card title="Proprietario">
        {ownerUser ? (
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-white font-medium">{ownerUser.displayName}</p>
              <p className="text-xs text-gray-500 mt-0.5">@{ownerUser.username}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
              Proprietario
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nessun proprietario assegnato.</p>
        )}
      </Card>

      <Card title="Sviluppatori">
        {developerGrants.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">Nessuno sviluppatore assegnato.</p>
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
                    Rimuovi
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
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">Seleziona utente…</option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
              ))}
            </select>
            <button
              onClick={() => void handleAdd()}
              disabled={addPending || !addUserId}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addPending ? '…' : 'Aggiungi'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}


/* ── Root ── */
export function SettingsTabs({
  session,
  tokens,
  users,
  projects,
  grantsPerProject,
  isAdmin,
  isTeamLeader,
}: Props) {

  const canManageUsers = isAdmin || isTeamLeader;

  const visibleTabs: Tab[] = [
    'Sicurezza',
    'Token MCP',
    ...(canManageUsers ? (['Utenti'] as Tab[]) : []),
    ...(isAdmin ? (['Membri'] as Tab[]) : []),
  ];

  const [active, setActive] = useState<Tab>(visibleTabs[0]);

  return (
    <div>
      <div className="flex gap-1 mb-6 rounded-xl p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === 'Sicurezza' && <SecurityTab />}
      {active === 'Token MCP' && <TokensTab session={session} initialTokens={tokens} />}
      {active === 'Utenti' && canManageUsers && (
        <UsersTab currentUserId={session.userId} initialUsers={users} isAdmin={isAdmin} />
      )}
      {active === 'Membri' && isAdmin && (
        <MembriTab
          users={users}
          grantsPerProject={grantsPerProject}
        />
      )}
    </div>
  );
}
