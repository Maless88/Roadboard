import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Cos’è il life-OS',
    body: 'RoadBoard sta diventando un life-OS agentico: un cockpit unico organizzato in tab (Aree) dove progetti, casa, studio, calendario ed email convivono, con agenti che lavorano sui tuoi dati.',
  },
  {
    title: 'Tab principali',
    body: 'Projectboard (gestione progetti, l’attuale RoadBoard) · Life/Home · Learn · Calendar · Email · Agents (Agent Office) · Ops/System · Guida · boardchat.',
  },
  {
    title: 'Agenti',
    body: 'Roster base: Coordinator (instrada), Secretary (email/calendar), Project/Dev, Researcher, Sentinel/Ops. Coordinano via stato condiviso (task, handoff, decisioni, memoria), non a voce. Ogni agente sceglie modello e runtime (API / CLI a sottoscrizione / locale).',
  },
  {
    title: 'boardchat',
    body: 'La chat trasversale per parlare con gli agenti dentro e fuori dalla dashboard (anche da mobile). Stessa sessione e memoria del cockpit: un cervello solo.',
  },
  {
    title: 'Ops / System',
    body: 'Stato in tempo reale di servizi e database del life-OS. Sola lettura.',
  },
];

export default async function GuidaPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const session = await validateSession(token);

  if (!session) redirect('/login');

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-100">Guida</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Come funziona il life-OS. Per collegare un agente via MCP usa il wizard dedicato.
        </p>

        <Link
          href="/mcp-guide"
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
        >
          Apri il wizard MCP →
        </Link>

        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
            >
              <h2 className="mb-1 text-sm font-semibold text-zinc-100">{s.title}</h2>
              <p className="text-sm leading-relaxed text-zinc-400">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
