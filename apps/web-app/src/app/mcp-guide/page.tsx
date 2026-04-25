import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'MCP Setup Guide — RoadBoard 2.0',
  description: 'Connect your AI coding assistant to RoadBoard via MCP',
};


const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? '<YOUR_MCP_URL>';
const TOOL_COUNT = 24;


function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {

  return (
    <pre className={`language-${lang} bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm text-green-300 font-mono whitespace-pre`}>
      {code}
    </pre>
  );
}


function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {

  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div className="flex-1 pb-8">
        <h3 className="text-white font-semibold text-base mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}


function Section({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {

  return (
    <section id={id} className="mb-16">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-700">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}


function Badge({ text, color = 'indigo' }: { text: string; color?: string }) {

  const colors: Record<string, string> = {
    indigo: 'bg-indigo-900 text-indigo-300 border-indigo-700',
    green: 'bg-green-900 text-green-300 border-green-700',
    yellow: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    gray: 'bg-gray-800 text-gray-300 border-gray-600',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[color] ?? colors.indigo}`}>
      {text}
    </span>
  );
}


export default function McpGuidePage() {

  const claudeCodeConfig = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          type: 'http',
          url: MCP_URL,
          headers: { Authorization: 'Bearer <YOUR_MCP_TOKEN>' },
        },
      },
    },
    null,
    2,
  );

  const zedConfigHttp = JSON.stringify(
    {
      context_servers: {
        roadboard: {
          source: 'custom',
          transport: {
            type: 'http',
            url: MCP_URL,
            headers: { Authorization: 'Bearer <YOUR_MCP_TOKEN>' },
          },
          settings: {},
        },
      },
    },
    null,
    2,
  );

  const zedConfigStdio = JSON.stringify(
    {
      context_servers: {
        roadboard: {
          source: 'custom',
          command: {
            path: 'npx',
            args: [
              '-y',
              'mcp-remote',
              MCP_URL,
              '--header',
              'Authorization: Bearer <YOUR_MCP_TOKEN>',
            ],
            env: {},
          },
          settings: {},
        },
      },
    },
    null,
    2,
  );

  const codexConfig = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          type: 'http',
          url: MCP_URL,
          headers: { Authorization: 'Bearer <YOUR_MCP_TOKEN>' },
        },
      },
    },
    null,
    2,
  );

  const tools: { name: string; desc: string; category: 'onboarding' | 'read' | 'context' | 'write' }[] = [
    { name: 'initial_instructions', desc: 'Protocollo operativo MCP: catalog dei tool, workflow raccomandato e regole. Chiamare una volta a inizio sessione.', category: 'onboarding' },

    { name: 'list_projects', desc: 'Elenca i progetti accessibili al token (filtrabile per status).', category: 'read' },
    { name: 'get_project', desc: 'Dettaglio di un progetto specifico.', category: 'read' },
    { name: 'list_teams', desc: 'Elenca i team dell\'utente con slug e ruolo. Richiesto prima di create_project.', category: 'read' },
    { name: 'list_phases', desc: 'Elenca le phase (milestone di roadmap) di un progetto.', category: 'read' },
    { name: 'list_active_tasks', desc: 'Task di un progetto, filtrabile per status.', category: 'read' },
    { name: 'get_project_memory', desc: 'Memory entry di un progetto, filtrabili per tipo.', category: 'read' },
    { name: 'list_recent_decisions', desc: 'Decisions del progetto (open, accepted, rejected, superseded).', category: 'read' },
    { name: 'search_memory', desc: 'Ricerca full-text nelle memory entry (title + body).', category: 'read' },
    { name: 'get_architecture_map', desc: 'Grafo di architettura: nodi (apps, package, moduli) ed edge.', category: 'read' },
    { name: 'get_node_context', desc: 'Contesto completo di un nodo: annotation, link a task/decision/memory, impact analysis.', category: 'read' },

    { name: 'prepare_project_summary', desc: 'Snapshot strutturato del progetto per onboarding agente.', category: 'context' },
    { name: 'prepare_task_context', desc: 'Contesto completo di un task: progetto, task, sibling, memory recenti.', category: 'context' },
    { name: 'get_project_changelog', desc: 'Changelog agent-readable: task summary, phase attive, decision e memory recenti, audit events.', category: 'context' },

    { name: 'create_project', desc: 'Crea un nuovo progetto. Richiede ownerTeamId/ownerTeamSlug (usa list_teams prima).', category: 'write' },
    { name: 'create_phase', desc: 'Crea una phase (milestone di roadmap) nel progetto.', category: 'write' },
    { name: 'update_phase', desc: 'Aggiorna phase esistente (titolo, status, date, decision collegata).', category: 'write' },
    { name: 'create_task', desc: 'Crea un task in una phase. Se phaseId è omesso usa la prima disponibile.', category: 'write' },
    { name: 'update_task', desc: 'Aggiorna campi del task (title, description, priority, phase, assignee, due date). Per lo status usa update_task_status.', category: 'write' },
    { name: 'update_task_status', desc: 'Cambia lo status. Con status=done richiede un completionReport markdown dettagliato.', category: 'write' },
    { name: 'create_memory_entry', desc: 'Scrive una memory entry tipizzata (done, next, decision, handoff, architecture, issue, learning, operational_note, open_question).', category: 'write' },
    { name: 'create_decision', desc: 'Registra una decision architetturale/di progetto con impact level.', category: 'write' },
    { name: 'update_decision', desc: 'Aggiorna una decision: status, outcome, rationale, risoluzione.', category: 'write' },
    { name: 'create_handoff', desc: 'Crea un handoff strutturato a fine sessione con next steps ordinati.', category: 'write' },
  ];

  const categoryColors: Record<string, string> = {
    onboarding: 'bg-indigo-900 text-indigo-300 border-indigo-700',
    read: 'bg-blue-900 text-blue-300 border-blue-700',
    context: 'bg-purple-900 text-purple-300 border-purple-700',
    write: 'bg-green-900 text-green-300 border-green-700',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header className="backdrop-blur sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-strong)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/projects" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>MCP Setup Guide</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge text="Streamable HTTP" color="green" />
            <Badge text={`${TOOL_COUNT} tool`} color="gray" />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Connetti il tuo AI assistant a RoadBoard</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Il server MCP di RoadBoard è accessibile via rete. Tutti gli agenti connessi condividono
            la stessa memoria di progetto in tempo reale.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-5 py-3">
            <span className="text-gray-400 text-sm">Endpoint MCP</span>
            <code className="text-green-400 font-mono text-sm">{MCP_URL}</code>
            <Badge text="online" color="green" />
          </div>
        </div>

        {/* Nav rapida */}
        <nav className="mb-12 grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { href: '#prereqs', icon: '🔑', label: 'Prerequisiti' },
            { href: '#claude-code', icon: '⚡', label: 'Claude Code' },
            { href: '#zed', icon: '🔷', label: 'Zed' },
            { href: '#codex', icon: '🟣', label: 'VS Code / Codex' },
            { href: '#protocol', icon: '🤖', label: 'Protocollo sessione' },
            { href: '#faq', icon: '❓', label: 'FAQ' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 hover:border-indigo-500 hover:bg-gray-800 transition-all text-sm font-medium"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Prerequisiti */}
        <Section id="prereqs" icon="🔑" title="Prerequisiti — Ottieni il tuo token MCP">
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-5 mb-6">
            <p className="text-indigo-200 text-sm leading-relaxed">
              Ogni utente ha il proprio token MCP personale. Il token autentica le tue richieste
              verso il server e autorizza l&apos;accesso ai progetti. Non condividere il tuo token.
            </p>
          </div>

          <Step n={1} title="Vai su Settings → Token MCP">
            <p className="text-gray-400 text-sm mb-2">
              Dalla dashboard vai su{' '}
              <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">Settings</a>
              {' '}→ tab <strong className="text-white">Token MCP</strong> → <strong className="text-white">Crea nuovo token</strong>.
            </p>
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                ⚠️ Il token raw viene mostrato <strong>una sola volta</strong> subito dopo la creazione.
                Copialo immediatamente.
              </p>
            </div>
          </Step>

          <Step n={2} title="Sostituisci i placeholder nelle configurazioni">
            <p className="text-gray-400 text-sm mb-2">
              In tutti gli esempi qui sotto, sostituisci:
            </p>
            <ul className="text-gray-400 text-sm space-y-1.5 list-disc list-inside">
              <li>
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">&lt;YOUR_MCP_TOKEN&gt;</code>{' '}
                con il token personale generato al passo 1.
              </li>
              <li>
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">&lt;YOUR_MCP_URL&gt;</code>{' '}
                con l&apos;endpoint MCP fornito dall&apos;amministratore
                (es. <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">http://host:3005/mcp</code>).
                Se l&apos;admin ha impostato <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_MCP_URL</code>{' '}
                nell&apos;env della web-app, gli esempi qui sotto lo mostrano già compilato.
              </li>
            </ul>
          </Step>
        </Section>

        {/* Claude Code */}
        <Section id="claude-code" icon="⚡" title="Claude Code">
          <div className="space-y-2 mb-6 text-sm text-gray-400">
            <p>
              Claude Code supporta MCP HTTP nativo. Aggiungi la configurazione nel file{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">.mcp.json</code>{' '}
              nella root del tuo progetto, oppure nel file globale{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.claude/settings.json</code>.
            </p>
          </div>

          <Step n={1} title="Crea o modifica .mcp.json nella root del progetto">
            <CodeBlock code={claudeCodeConfig} />
          </Step>

          <Step n={2} title="Riavvia Claude Code o esegui /mcp">
            <p className="text-gray-400 text-sm mb-3">
              Dopo aver salvato il file, Claude Code rileva automaticamente i cambiamenti.
              Puoi verificare con il comando slash:
            </p>
            <CodeBlock code="/mcp" lang="bash" />
            <p className="text-gray-400 text-sm mt-3">
              Dovresti vedere <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">roadboard</code> nell&apos;elenco dei server connessi con {TOOL_COUNT} tool disponibili.
            </p>
          </Step>

          <Step n={3} title="Testa il collegamento">
            <p className="text-gray-400 text-sm mb-3">In una conversazione con Claude, prova:</p>
            <CodeBlock code={'Usa il tool list_projects di roadboard per mostrarmi i progetti disponibili.'} lang="text" />
          </Step>
        </Section>

        {/* Zed */}
        <Section id="zed" icon="🔷" title="Zed">
          <div className="mb-6 text-sm text-gray-400">
            <p>
              Zed supporta MCP tramite Context Servers. La configurazione va in{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.config/zed/settings.json</code>
              {' '}(oppure via <strong className="text-white">Agent Panel → Settings → Context Servers → + Add Custom Server</strong>).
            </p>
          </div>

          <Step n={1} title="Configurazione HTTP (raccomandata)">
            <CodeBlock code={zedConfigHttp} />
          </Step>

          <Step n={2} title="Configurazione stdio via mcp-remote (fallback)">
            <p className="text-gray-400 text-sm mb-3">
              Se la versione di Zed non espone ancora il transport HTTP, fai proxy con{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">mcp-remote</code>:
            </p>
            <CodeBlock code={zedConfigStdio} />
            <p className="text-gray-400 text-sm mt-3">
              Richiede <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">npx</code> (Node 18+) nel PATH.
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs ml-1">mcp-remote</code>{' '}
              è il proxy ufficiale mantenuto da Anthropic per esporre un endpoint HTTP MCP come stdio server.
            </p>
          </Step>

          <Step n={3} title="Verifica in Zed">
            <p className="text-gray-400 text-sm">
              Apri l&apos;Agent Panel (<kbd className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-xs">Ctrl+?</kbd>) → dovresti vedere
              RoadBoard nell&apos;elenco dei context server attivi, con {TOOL_COUNT} tool esposti.
            </p>
          </Step>
        </Section>

        {/* VS Code / Codex */}
        <Section id="codex" icon="🟣" title="VS Code — GitHub Copilot / Codex">
          <div className="mb-6 text-sm text-gray-400">
            <p className="mb-2">
              VS Code con GitHub Copilot (Agent Mode) supporta MCP tramite il file{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">.vscode/mcp.json</code>{' '}
              nel workspace, oppure nelle impostazioni utente.
            </p>
          </div>

          <Step n={1} title="Crea .vscode/mcp.json nel tuo workspace">
            <CodeBlock code={codexConfig} />
          </Step>

          <Step n={2} title="Abilita MCP in VS Code">
            <p className="text-gray-400 text-sm mb-3">
              Apri <strong className="text-white">Settings</strong> e cerca:
            </p>
            <CodeBlock code={'chat.mcp.enabled: true'} lang="text" />
            <p className="text-gray-400 text-sm mt-3">
              Oppure aggiungi nelle impostazioni JSON:
            </p>
            <CodeBlock code={JSON.stringify({ 'chat.mcp.enabled': true }, null, 2)} />
          </Step>

          <Step n={3} title="Avvia Agent Mode e verifica">
            <p className="text-gray-400 text-sm mb-3">
              In GitHub Copilot Chat, passa ad <strong className="text-white">Agent Mode</strong> (icona ▶ o seleziona dal dropdown).
              Clicca sull&apos;icona degli strumenti per verificare che <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">roadboard</code> sia nell&apos;elenco.
            </p>
          </Step>
        </Section>

        {/* Tool disponibili */}
        <Section id="tools" icon="🛠️" title={`Tool disponibili (${TOOL_COUNT})`}>
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {(['onboarding', 'read', 'context', 'write'] as const).map((cat) => (
              <span key={cat} className={`inline-flex items-center px-2 py-0.5 rounded border font-medium ${categoryColors[cat]}`}>
                {cat}
              </span>
            ))}
          </div>
          <div className="grid gap-2">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors"
              >
                <code className="text-green-400 font-mono text-sm flex-shrink-0 w-52">{tool.name}</code>
                <span className="text-gray-400 text-sm flex-1">{tool.desc}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium flex-shrink-0 ${categoryColors[tool.category]}`}>
                  {tool.category}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Protocollo di sessione */}
        <Section id="protocol" icon="🤖" title="Protocollo di sessione per agenti">
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-5 mb-6">
            <p className="text-indigo-200 text-sm leading-relaxed">
              Il tool <code className="text-green-400 bg-gray-900/60 px-1.5 py-0.5 rounded">initial_instructions</code> definisce il protocollo operativo del server MCP.
              Va chiamato <strong>una sola volta a inizio sessione</strong> per iniettare il catalog dei tool, il workflow raccomandato e le regole operative nell&apos;LLM.
            </p>
          </div>

          <Step n={1} title="Aggiungi la regola al tuo CLAUDE.md (o equivalente)">
            <p className="text-gray-400 text-sm mb-3">
              Per rendere l&apos;onboarding automatico, aggiungi questa riga nelle istruzioni del tuo agente:
            </p>
            <CodeBlock
              code={`## MCP Operational Protocols\n- **RoadBoard 2.0 MCP**: If tools are available and you have NOT yet called\n  \`initial_instructions()\` in this session, call it IMMEDIATELY — before any\n  other response. It loads the operational protocol, tool catalog and workflow.`}
              lang="markdown"
            />
          </Step>

          <Step n={2} title="Workflow raccomandato (restituito da initial_instructions)">
            <div className="space-y-2">
              {[
                { n: 1, action: 'Onboarding: prepare_project_summary(projectId) oppure get_project_changelog(projectId) per caricare lo stato del progetto.' },
                { n: 2, action: 'Se lavori su un task specifico: prepare_task_context(projectId, taskId).' },
                { n: 3, action: 'Planning — SEMPRE in questo ordine: list_phases(projectId) → se esiste una phase adatta usa quel phaseId con create_task, altrimenti create_phase e poi create_task. Mai task senza phaseId.' },
                { n: 4, action: 'Durante il lavoro: update_task_status a in_progress all\'inizio, a done alla fine (con completionReport dettagliato).' },
                { n: 5, action: 'Decisioni architetturali o di scope: create_decision con impact level. Aggiorna con update_decision quando l\'outcome è noto.' },
                { n: 6, action: 'Ogni scoperta, finding o milestone rilevante: create_memory_entry autonomamente (non chiedere permesso).' },
                { n: 7, action: 'Ricerca di contesto pregresso: search_memory(projectId, query) invece di leggere tutte le memory.' },
                { n: 8, action: 'A fine sessione: create_handoff con summary e next steps ordinati.' },
              ].map((item) => (
                <div key={item.n} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{item.n}</span>
                  <span className="text-gray-400 text-sm">{item.action}</span>
                </div>
              ))}
            </div>
          </Step>

          <Step n={3} title="Regole operative">
            <div className="space-y-2">
              {[
                'Chiama initial_instructions una volta a inizio sessione.',
                'Apri o identifica sempre un task (con phaseId) prima di iniziare a lavorare.',
                'Mai creare task senza phaseId: usa list_phases prima, create_phase se serve.',
                'Non dichiarare completion senza update_task_status=done + completionReport.',
                'Usa create_memory_entry per persistere decisioni e scoperte (non chiedere permesso).',
                'Per decision architetturali formali usa create_decision, non create_memory_entry type=decision.',
                'Prima di create_project chiama list_teams e chiedi all\'utente l\'owner team.',
                'Chiama sempre create_handoff a fine sessione.',
                'Preferisci prepare_project_summary / get_project_changelog a letture multiple per l\'onboarding.',
                'Se il projectId è sconosciuto, chiama prima list_projects.',
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <span className="text-gray-400 text-sm">{rule}</span>
                </div>
              ))}
            </div>
          </Step>
        </Section>

        {/* FAQ */}
        <Section id="faq" icon="❓" title="Domande frequenti">
          <div className="space-y-4">
            {[
              {
                q: 'Serve un token diverso per ogni client (Claude Code, Zed, VS Code)?',
                a: 'No. Lo stesso token MCP funziona per tutti i client: autentica l\'utente, non la macchina. Puoi però crearne più di uno (es. uno per desktop, uno per laptop) dalla pagina Settings → Token MCP, così puoi revocarne uno senza rompere gli altri.',
              },
              {
                q: 'Posso far lavorare più agenti in parallelo sullo stesso progetto?',
                a: 'Sì. Tutti gli agenti connessi condividono la stessa memoria di progetto in tempo reale: tasks, phases, decisions e memory entry sono persistite su PostgreSQL. Se due agenti aggiornano lo stesso task in contemporanea vince l\'ultima scrittura, quindi conviene coordinarli via create_handoff o assegnando task diversi.',
              },
              {
                q: 'Le chiamate MCP consumano i token del mio piano Claude / Copilot?',
                a: 'Le chiamate ai tool MCP non sono di per sé chiamate LLM: sono richieste HTTP verso il server RoadBoard. Consumano token del modello solo per la parte di prompt in cui l\'agente ragiona sui risultati. Per ridurre il consumo prediligi prepare_project_summary o get_project_changelog invece di multiple letture separate.',
              },
              {
                q: 'Perché devo chiamare list_phases prima di create_task?',
                a: 'Il dominio di RoadBoard non consente task orfani: ogni task vive dentro una phase (milestone). list_phases ti fa scegliere quella giusta; se nessuna esiste, create_phase prima. Se ometti phaseId, create_task usa la prima phase disponibile del progetto come fallback, ma è un comportamento implicito da evitare in planning formale.',
              },
              {
                q: 'Qual è la differenza fra create_decision e create_memory_entry con type=decision?',
                a: 'create_decision è il canale ufficiale per decisioni architetturali/di scope: supporta status (open/accepted/rejected/superseded), impact level, rationale e outcome strutturati, e alimenta list_recent_decisions e il changelog. create_memory_entry type=decision è un fallback più leggero — usalo solo per note veloci, non per decisioni che devono essere tracciate nel tempo.',
              },
              {
                q: 'Se sto offline il server MCP funziona lo stesso?',
                a: 'No: il server MCP è sempre quello centrale (HTTP sullo stesso endpoint della guida). Per lavoro offline c\'è il servizio local-sync-bridge (porta 3004) con SQLite, ma è usato dai tool di RoadBoard e non è esposto via MCP. Se il server centrale non è raggiungibile i tool ritornano errore.',
              },
              {
                q: 'Posso restringere cosa può fare un token MCP?',
                a: 'Sì: ogni token ha uno scope (lettura, scrittura, admin) e una lista di progetti autorizzati. Dalla pagina Settings → Token MCP puoi creare token dedicati con permessi minimi — utile per dare a un agente accesso read-only a un sottoinsieme di progetti.',
              },
              {
                q: 'Come aggiorno la URL dell\'endpoint MCP?',
                a: 'L\'admin imposta NEXT_PUBLIC_MCP_URL nell\'env della web-app e rifà il build (è una variabile Next.js public, viene inlinata a compile time). Gli esempi in questa pagina si aggiornano automaticamente. Client già configurati devono aggiornare la url anche nel loro .mcp.json / settings.',
              },
              {
                q: 'initial_instructions va richiamato a ogni messaggio?',
                a: 'No, una volta per sessione è sufficiente. Restituisce il catalog dei tool, il workflow raccomandato e le regole operative. Richiamarlo di nuovo è idempotente ma sprecato: le informazioni sono già nel contesto dell\'agente dopo la prima chiamata.',
              },
              {
                q: 'Cosa succede se non chiamo create_handoff a fine sessione?',
                a: 'Niente si rompe, ma il prossimo agente ripartirà da zero: dovrà chiamare prepare_project_summary e ricostruire il contesto dalle memory entry. create_handoff lascia un\'entry tipizzata "handoff" con summary e next steps ordinati, che è il modo più veloce per un altro agente di capire "a che punto eravamo".',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group bg-gray-900 border border-gray-800 rounded-lg open:border-indigo-700 transition-colors"
              >
                <summary className="cursor-pointer list-none flex items-start gap-3 px-4 py-3">
                  <span className="text-indigo-400 font-mono text-sm flex-shrink-0 group-open:rotate-90 transition-transform">▶</span>
                  <span className="text-white text-sm font-medium flex-1">{item.q}</span>
                </summary>
                <div className="px-4 pb-4 pl-11 text-gray-400 text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshooting" icon="🔧" title="Troubleshooting">
          <div className="space-y-4">
            {[
              {
                problem: '401 Unauthorized',
                solution: 'Il token MCP non è valido o è stato revocato. Genera un nuovo token dalla pagina Settings → Token MCP.',
              },
              {
                problem: 'Connection refused sull\'endpoint MCP',
                solution: 'Il server MCP HTTP non è in esecuzione o la URL è errata. Richiede MCP_TRANSPORT=http (porta configurabile via MCP_HTTP_PORT, default 3005). La URL mostrata in questa pagina viene da NEXT_PUBLIC_MCP_URL: se è sbagliata, aggiornala nell\'env della web-app e rifai il build.',
              },
              {
                problem: '0 tool mostrati nel client',
                solution: 'Alcuni client MCP richiedono l\'header Accept: application/json, text/event-stream. Claude Code, Zed recenti e VS Code lo inviano automaticamente; se stai usando un client custom aggiungilo.',
              },
              {
                problem: 'Zed non riconosce il transport HTTP',
                solution: 'Usa la configurazione stdio di fallback con mcp-remote: fa da proxy stdio → HTTP verso lo stesso endpoint.',
              },
              {
                problem: 'create_task fallisce con "phaseId required"',
                solution: 'Chiama prima list_phases(projectId) e passa un phaseId valido, oppure crea la phase con create_phase. Il workflow non consente task orfani.',
              },
            ].map((item) => (
              <div key={item.problem} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="text-red-400 font-mono text-sm font-medium mb-1">❌ {item.problem}</p>
                <p className="text-gray-400 text-sm">✅ {item.solution}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer className="pt-8 text-center text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
          <p>RoadBoard 2.0 · MCP Streamable HTTP · {TOOL_COUNT} tool esposti</p>
          <p className="mt-1">
            Hai problemi?{' '}
            <a href="/projects" className="text-indigo-400 hover:text-indigo-300">
              Torna alla dashboard
            </a>
          </p>
        </footer>

      </div>
    </div>
  );
}
