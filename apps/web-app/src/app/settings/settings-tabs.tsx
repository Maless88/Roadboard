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
  createGrantAction,
  deleteGrantAction,
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


const TABS = ['Sicurezza', 'Token MCP', 'Utenti', 'Grant'] as const;
type Tab = typeof TABS[number];


const GRANT_TYPES = [
  'project.read',
  'project.write',
  'project.admin',
  'task.write',
  'memory.write',
  'decision.write',
  'dashboard.read',
  'token.manage',
];


function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {

  const base = 'rounded-md px-4 py-3 text-sm border';
  const cls = type === 'error'
    ? `${base} bg-red-950 border-red-800 text-red-300`
    : `${base} bg-green-950 border-green-800 text-green-300`;

  return <div className={cls}>{msg}</div>;
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
        className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
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
          <div className="bg-gray-900 border border-green-700 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-green-400 mb-1">Token creato</h3>
            <p className="text-xs text-gray-400 mb-4">
              Copialo adesso — non sarà più visibile dopo aver chiuso questa finestra.
            </p>
            <code className="block bg-gray-950 border border-green-800 rounded-lg px-4 py-3 text-green-400 font-mono text-xs break-all leading-relaxed">
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
          <div className="divide-y divide-gray-800">
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
  admin: 'text-yellow-400 bg-yellow-950 border-yellow-800',
  team_leader: 'text-blue-400 bg-blue-950 border-blue-800',
  developer: 'text-green-400 bg-green-950 border-green-800',
  guest: 'text-gray-400 bg-gray-800 border-gray-700',
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
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
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
        <div className="divide-y divide-gray-800">
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
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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


/* ── Tab: Grant ── */
function GrantsTab({
  session,
  users,
  projects,
  grantsPerProject,
}: {
  session: SessionInfo;
  users: User[];
  projects: Project[];
  grantsPerProject: { project: Project; grants: Grant[] }[];
}) {

  const [grantState, grantAction, grantPending] = useActionState(createGrantAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [localGrants, setLocalGrants] = useState(grantsPerProject);

  useEffect(() => {

    if (grantState.success) formRef.current?.reset();
  }, [grantState.success]);

  async function handleDelete(grantId: string, projectId: string) {

    await deleteGrantAction(grantId);
    setLocalGrants((prev) =>
      prev.map((pg) =>
        pg.project.id === projectId
          ? { ...pg, grants: pg.grants.filter((g) => g.id !== grantId) }
          : pg,
      ),
    );
  }

  function subjectLabel(grant: Grant): string {

    if (grant.subjectType === 'user') {
      return users.find((u) => u.id === grant.subjectId)?.username ?? grant.subjectId.slice(0, 8);
    }

    return `team:${grant.subjectId.slice(0, 8)}`;
  }

  return (
    <div className="space-y-5">

      {localGrants.map(({ project, grants }) => (
        <Card key={project.id} title={`${project.name} — grant attivi`}>
          {grants.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun grant.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {grants.map((g) => (
                <div key={g.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                      {g.subjectType}
                    </span>
                    <span className="text-sm text-white font-mono text-xs">{subjectLabel(g)}</span>
                    <span className="text-xs text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                      {g.grantType}
                    </span>
                  </div>
                  <button
                    onClick={() => void handleDelete(g.id, project.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Card title="Aggiungi grant">
        <form ref={formRef} action={grantAction} className="space-y-4 max-w-sm">
          {grantState.error && <Alert type="error" msg={grantState.error} />}
          {grantState.success && <Alert type="success" msg="Grant aggiunto." />}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Progetto</label>
            <select
              name="projectId"
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tipo soggetto</label>
            <select
              name="subjectType"
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">user</option>
              <option value="team">team</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Utente</label>
            <select
              name="subjectId"
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tipo grant</label>
            <select
              name="grantType"
              className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {GRANT_TYPES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <SubmitBtn pending={grantPending} label="Aggiungi grant" />
        </form>
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
    ...(isAdmin ? (['Grant'] as Tab[]) : []),
  ];

  const [active, setActive] = useState<Tab>(visibleTabs[0]);

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
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
      {active === 'Grant' && isAdmin && (
        <GrantsTab
          session={session}
          users={users}
          projects={projects}
          grantsPerProject={grantsPerProject}
        />
      )}
    </div>
  );
}
