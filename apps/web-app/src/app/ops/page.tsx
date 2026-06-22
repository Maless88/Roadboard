import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, getOpsStatus } from '@/lib/api';
import type { OpsStatus } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: string }) {

  const ok = status === 'ok';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
      {status}
    </span>
  );
}

export default async function OpsPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const session = await validateSession(token);

  if (!session) redirect('/login');

  let ops: OpsStatus | null = null;
  let error: string | null = null;

  try {
    ops = await getOpsStatus(token);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-100">Ops / System</h1>
          {ops ? (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                ops.overall === 'ok'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {ops.overall}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            Impossibile leggere lo stato: {error}
          </div>
        ) : null}

        {ops ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Componente</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium">Latenza</th>
                  <th className="px-4 py-3 font-medium">Dettaglio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                <tr>
                  <td className="px-4 py-3">{ops.api.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ops.api.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">—</td>
                  <td className="px-4 py-3 text-zinc-500">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">{ops.database.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ops.database.status} />
                  </td>
                  <td className="px-4 py-3">
                    {ops.database.latencyMs != null ? `${ops.database.latencyMs} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{ops.database.detail ?? '—'}</td>
                </tr>
                {ops.services.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      {s.latencyMs != null ? `${s.latencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{s.detail ?? '—'}</td>
                  </tr>
                ))}
                {ops.services.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-zinc-500">
                      Nessun servizio configurato (imposta OPS_HEALTH_TARGETS).
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="border-t border-white/5 px-4 py-2 text-xs text-zinc-500">
              Aggiornato: {new Date(ops.generatedAt).toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
