import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'MCP Setup Guide — RoadBoard 2.0',
  description: 'Connect your AI coding assistant to RoadBoard via MCP',
};


const MCP_URL = 'http://10.0.254.5:3005/mcp';


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

  const zedConfig = JSON.stringify(
    {
      context_servers: {
        roadboard: {
          command: {
            path: 'npx',
            args: ['-y', '@modelcontextprotocol/client-cli', MCP_URL],
            env: { MCP_BEARER_TOKEN: '<YOUR_MCP_TOKEN>' },
          },
          settings: {},
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

  const tools = [
    { name: 'initial_instructions', desc: 'Protocollo operativo MCP: catalog dei tool, workflow raccomandato e regole. Chiamare una volta a inizio sessione.', category: 'onboarding' },
    { name: 'list_projects', desc: 'Elenca tutti i progetti accessibili al token', category: 'read' },
    { name: 'get_project', desc: 'Dettaglio di un progetto specifico', category: 'read' },
    { name: 'list_active_tasks', desc: 'Task di un progetto, filtrabile per status', category: 'read' },
    { name: 'get_project_memory', desc: 'Legge le memory entry di un progetto', category: 'read' },
    { name: 'prepare_project_summary', desc: 'Snapshot narrativo del progetto per onboarding agente', category: 'context' },
    { name: 'prepare_task_context', desc: 'Contesto completo per un task (progetto + task + sibling + memory)', category: 'context' },
    { name: 'create_task', desc: 'Crea un nuovo task in un progetto', category: 'write' },
    { name: 'update_task_status', desc: 'Aggiorna lo status di un task', category: 'write' },
    { name: 'create_memory_entry', desc: 'Scrive una memory entry nel progetto', category: 'write' },
    { name: 'create_handoff', desc: 'Crea un handoff strutturato a fine sessione', category: 'write' },
  ];

  const categoryColors: Record<string, string> = {
    onboarding: 'bg-indigo-900 text-indigo-300 border-indigo-700',
    read: 'bg-blue-900 text-blue-300 border-blue-700',
    context: 'bg-purple-900 text-purple-300 border-purple-700',
    write: 'bg-green-900 text-green-300 border-green-700',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/projects" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</a>
            <span className="text-gray-700">/</span>
            <span className="text-white font-semibold">MCP Setup Guide</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge text="Streamable HTTP" color="green" />
            <Badge text="v1.29.0 SDK" color="gray" />
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
        <nav className="mb-12 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { href: '#prereqs', icon: '🔑', label: 'Prerequisiti' },
            { href: '#claude-code', icon: '⚡', label: 'Claude Code' },
            { href: '#zed', icon: '🔷', label: 'Zed' },
            { href: '#codex', icon: '🟣', label: 'VS Code / Codex' },
            { href: '#protocol', icon: '🤖', label: 'Protocollo sessione' },
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

          <Step n={2} title="Sostituisci il placeholder nelle configurazioni">
            <p className="text-gray-400 text-sm">
              In tutti gli esempi qui sotto, sostituisci{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">&lt;YOUR_MCP_TOKEN&gt;</code>{' '}
              con il token che hai ricevuto.
            </p>
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
              Dovresti vedere <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">roadboard</code> nell&apos;elenco dei server connessi con 11 tool disponibili.
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
            <p className="mb-2">
              Zed supporta MCP tramite Context Servers. La configurazione va in{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.config/zed/settings.json</code>.
            </p>
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mt-3">
              <p className="text-yellow-200 text-sm">
                ⚠️ Il supporto HTTP nativo in Zed dipende dalla versione. Nelle versioni recenti (0.140+)
                è disponibile il transport HTTP diretto. Per versioni precedenti usa la configurazione stdio di fallback qui sotto.
              </p>
            </div>
          </div>

          <Step n={1} title="Configurazione HTTP nativa (Zed 0.140+) — raccomandata">
            <p className="text-gray-400 text-sm mb-3">
              Apri <strong className="text-white">Zed → Settings → Open Settings (JSON)</strong> e aggiungi:
            </p>
            <CodeBlock code={zedConfigHttp} />
          </Step>

          <Step n={2} title="Configurazione stdio di fallback (versioni precedenti)">
            <p className="text-gray-400 text-sm mb-3">
              Se la configurazione HTTP non è riconosciuta, usa questo approccio alternativo:
            </p>
            <CodeBlock code={zedConfig} />
            <p className="text-gray-400 text-sm mt-3">
              Richiede <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">npx</code> nel PATH.
            </p>
          </Step>

          <Step n={3} title="Verifica in Zed">
            <p className="text-gray-400 text-sm">
              Apri l&apos;AI Panel (<kbd className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-xs">Ctrl+?</kbd>) → dovresti vedere
              RoadBoard nell&apos;elenco dei context server attivi.
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
        <Section id="tools" icon="🛠️" title="Tool disponibili">
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
              code={`## MCP Operational Protocols\n- **RoadBoard 2.0 MCP**: If tools are available, you MUST execute \`initial_instructions()\`\n  at the start of every session to load the operational protocol, tool catalog,\n  and workflow rules.`}
              lang="markdown"
            />
          </Step>

          <Step n={2} title="Workflow raccomandato (restituito da initial_instructions)">
            <div className="space-y-2">
              {[
                { n: 1, action: 'Chiama prepare_project_summary(projectId) per caricare il contesto completo del progetto.' },
                { n: 2, action: 'Se lavori su un task specifico, chiama prepare_task_context(projectId, taskId).' },
                { n: 3, action: 'Prima di iniziare, verifica che esista un task. Usa create_task se necessario.' },
                { n: 4, action: 'Aggiorna lo status del task con update_task_status man mano che avanzi.' },
                { n: 5, action: 'Salva decisioni importanti con create_memory_entry.' },
                { n: 6, action: 'A fine sessione chiama create_handoff per preservare il contesto.' },
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
                'Apri o identifica sempre un task prima di iniziare a lavorare.',
                'Non dichiarare completion senza aggiornare lo status del task.',
                'Usa create_memory_entry per persistere decisioni architetturali e scoperte rilevanti.',
                'Chiama sempre create_handoff a fine sessione.',
                'Preferisci prepare_project_summary a letture multiple per l\'onboarding.',
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

        {/* Troubleshooting */}
        <Section id="troubleshooting" icon="🔧" title="Troubleshooting">
          <div className="space-y-4">
            {[
              {
                problem: '401 Unauthorized',
                solution: 'Il token MCP non è valido o è stato revocato. Genera un nuovo token dalla pagina Settings.',
              },
              {
                problem: 'Connection refused su 10.0.254.5:3005',
                solution: 'Il server MCP HTTP non è in esecuzione. Contatta l\'amministratore per riavviare il servizio (MCP_TRANSPORT=http).',
              },
              {
                problem: '0 tool mostrati nella configurazione',
                solution: "Aggiungi 'Accept: application/json, text/event-stream' agli header. Alcuni client MCP lo aggiungono automaticamente.",
              },
              {
                problem: 'Zed non riconosce la configurazione',
                solution: 'Verifica la versione di Zed. Il transport HTTP richiede Zed 0.140+. Usa la configurazione stdio di fallback per versioni precedenti.',
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
        <footer className="border-t border-gray-800 pt-8 text-center text-gray-600 text-sm">
          <p>RoadBoard 2.0 · MCP Streamable HTTP · SDK v1.29.0</p>
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
