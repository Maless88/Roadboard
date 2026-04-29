import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n/types';


export async function generateMetadata(): Promise<Metadata> {

  const dict = await getDict();

  return {
    title: dict.mcp.metaTitle,
    description: dict.mcp.metaDescription,
  };
}


const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? '<YOUR_MCP_URL>';
const TOOL_COUNT = 32;


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


function buildTools(dict: Dictionary): { name: string; desc: string; category: 'onboarding' | 'read' | 'context' | 'write' }[] {

  const d = dict.mcp.tools.descriptions;

  const get = (name: string): string => d[name] ?? '';

  return [
    { name: 'initial_instructions', desc: get('initial_instructions'), category: 'onboarding' },

    { name: 'list_projects', desc: get('list_projects'), category: 'read' },
    { name: 'get_project', desc: get('get_project'), category: 'read' },
    { name: 'list_teams', desc: get('list_teams'), category: 'read' },
    { name: 'list_phases', desc: get('list_phases'), category: 'read' },
    { name: 'list_active_tasks', desc: get('list_active_tasks'), category: 'read' },
    { name: 'get_project_memory', desc: get('get_project_memory'), category: 'read' },
    { name: 'list_recent_decisions', desc: get('list_recent_decisions'), category: 'read' },
    { name: 'search_memory', desc: get('search_memory'), category: 'read' },
    { name: 'get_architecture_map', desc: get('get_architecture_map'), category: 'read' },
    { name: 'get_node_context', desc: get('get_node_context'), category: 'read' },

    { name: 'prepare_project_summary', desc: get('prepare_project_summary'), category: 'context' },
    { name: 'prepare_task_context', desc: get('prepare_task_context'), category: 'context' },
    { name: 'get_project_changelog', desc: get('get_project_changelog'), category: 'context' },

    { name: 'create_project', desc: get('create_project'), category: 'write' },
    { name: 'create_phase', desc: get('create_phase'), category: 'write' },
    { name: 'update_phase', desc: get('update_phase'), category: 'write' },
    { name: 'create_task', desc: get('create_task'), category: 'write' },
    { name: 'update_task', desc: get('update_task'), category: 'write' },
    { name: 'update_task_status', desc: get('update_task_status'), category: 'write' },
    { name: 'create_memory_entry', desc: get('create_memory_entry'), category: 'write' },
    { name: 'create_decision', desc: get('create_decision'), category: 'write' },
    { name: 'update_decision', desc: get('update_decision'), category: 'write' },
    { name: 'create_handoff', desc: get('create_handoff'), category: 'write' },
    { name: 'delete_task', desc: get('delete_task'), category: 'write' },
    { name: 'create_architecture_repository', desc: get('create_architecture_repository'), category: 'write' },
    { name: 'create_architecture_node', desc: get('create_architecture_node'), category: 'write' },
    { name: 'create_architecture_edge', desc: get('create_architecture_edge'), category: 'write' },
    { name: 'create_architecture_link', desc: get('create_architecture_link'), category: 'write' },
    { name: 'create_architecture_annotation', desc: get('create_architecture_annotation'), category: 'write' },
    { name: 'link_task_to_node', desc: get('link_task_to_node'), category: 'write' },
    { name: 'ingest_architecture', desc: get('ingest_architecture'), category: 'write' },
  ];
}


export default async function McpGuidePage() {

  const dict = await getDict();

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
          enabled: true,
          url: MCP_URL,
          headers: { Authorization: 'Bearer <YOUR_MCP_TOKEN>' },
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
          enabled: true,
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            MCP_URL,
            '--header',
            'Authorization: Bearer <YOUR_MCP_TOKEN>',
          ],
          env: {},
        },
      },
    },
    null,
    2,
  );

  const vsCodeConfig = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          url: MCP_URL,
          headers: { Authorization: 'Bearer <YOUR_MCP_TOKEN>' },
        },
      },
    },
    null,
    2,
  );

  const codexConfigToml = `[mcp_servers.roadboard]
url = "${MCP_URL}"
bearer_token_env_var = "ROADBOARD_MCP_TOKEN"

# Optional: per-tool approval gating
# [mcp_servers.roadboard.tools.roadboard_update_task_status]
# approval_mode = "approve"`;

  const codexConfigTomlStdio = `[mcp_servers.my-local-server]
command = "/path/to/mcp-binary"
args = ["start"]
env = { KEY = "value" }`;

  const codexEnvSetup = `# bash / zsh
export ROADBOARD_MCP_TOKEN="<YOUR_MCP_TOKEN>"
# add to ~/.bashrc or ~/.zshrc to persist

# fish
set -x ROADBOARD_MCP_TOKEN "<YOUR_MCP_TOKEN>"
# add to ~/.config/fish/config.fish`;

  const tools = buildTools(dict);

  const workflows = [
    { n: 1, action: dict.mcp.protocol.workflow1 },
    { n: 2, action: dict.mcp.protocol.workflow2 },
    { n: 3, action: dict.mcp.protocol.workflow3 },
    { n: 4, action: dict.mcp.protocol.workflow4 },
    { n: 5, action: dict.mcp.protocol.workflow5 },
    { n: 6, action: dict.mcp.protocol.workflow6 },
    { n: 7, action: dict.mcp.protocol.workflow7 },
    { n: 8, action: dict.mcp.protocol.workflow8 },
  ];

  const rules = [
    dict.mcp.protocol.rule1,
    dict.mcp.protocol.rule2,
    dict.mcp.protocol.rule3,
    dict.mcp.protocol.rule4,
    dict.mcp.protocol.rule5,
    dict.mcp.protocol.rule6,
    dict.mcp.protocol.rule7,
    dict.mcp.protocol.rule8,
    dict.mcp.protocol.rule9,
    dict.mcp.protocol.rule10,
  ];

  const faqItems = [
    { q: dict.mcp.faq.q1, a: dict.mcp.faq.a1 },
    { q: dict.mcp.faq.q2, a: dict.mcp.faq.a2 },
    { q: dict.mcp.faq.q3, a: dict.mcp.faq.a3 },
    { q: dict.mcp.faq.q4, a: dict.mcp.faq.a4 },
    { q: dict.mcp.faq.q5, a: dict.mcp.faq.a5 },
    { q: dict.mcp.faq.q6, a: dict.mcp.faq.a6 },
    { q: dict.mcp.faq.q7, a: dict.mcp.faq.a7 },
    { q: dict.mcp.faq.q8, a: dict.mcp.faq.a8 },
    { q: dict.mcp.faq.q9, a: dict.mcp.faq.a9 },
    { q: dict.mcp.faq.q10, a: dict.mcp.faq.a10 },
    { q: dict.mcp.faq.q11, a: dict.mcp.faq.a11 },
  ];

  const troubleshooting = [
    { problem: dict.mcp.troubleshooting.case1Title, solution: dict.mcp.troubleshooting.case1Body },
    { problem: dict.mcp.troubleshooting.case2Title, solution: dict.mcp.troubleshooting.case2Body },
    { problem: dict.mcp.troubleshooting.case3Title, solution: dict.mcp.troubleshooting.case3Body },
    { problem: dict.mcp.troubleshooting.case4Title, solution: dict.mcp.troubleshooting.case4Body },
    { problem: dict.mcp.troubleshooting.case5Title, solution: dict.mcp.troubleshooting.case5Body },
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
            <a href="/projects" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>{dict.mcp.headerBack}</a>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{dict.mcp.headerTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge text={dict.mcp.badgeStreamable} color="green" />
            <Badge text={dict.mcp.badgeToolCount(TOOL_COUNT)} color="gray" />
          </div>
        </div>
      </header>

      {/* Wizard banner */}
      <div className="bg-indigo-950/60 border-b border-indigo-800/50 py-3 px-6 text-center text-sm text-indigo-200">
        Stai vedendo la reference completa —{' '}
        <a href="/mcp-guide" className="text-indigo-300 underline hover:text-indigo-200 font-medium">
          usa il wizard guidato
        </a>{' '}
        per un setup step-by-step.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">{dict.mcp.heroTitle}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {dict.mcp.heroDescription}
          </p>
          <div className="mt-6 inline-flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-5 py-3">
            <span className="text-gray-400 text-sm">{dict.mcp.endpointLabel}</span>
            <code className="text-green-400 font-mono text-sm">{MCP_URL}</code>
            <Badge text={dict.mcp.badgeOnline} color="green" />
          </div>
        </div>

        {/* Nav rapida */}
        <nav className="mb-12 grid grid-cols-2 md:grid-cols-7 gap-3">
          {[
            { href: '#prereqs', icon: '🔑', label: dict.mcp.nav.prereqs },
            { href: '#claude-code', icon: '⚡', label: dict.mcp.nav.claudeCode },
            { href: '#zed', icon: '🔷', label: dict.mcp.nav.zed },
            { href: '#vscode', icon: '🟦', label: dict.mcp.nav.vscode },
            { href: '#codex', icon: '🟣', label: dict.mcp.nav.codex },
            { href: '#protocol', icon: '🤖', label: dict.mcp.nav.protocol },
            { href: '#faq', icon: '❓', label: dict.mcp.nav.faq },
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
        <Section id="prereqs" icon="🔑" title={dict.mcp.prereqs.title}>
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-5 mb-6">
            <p className="text-indigo-200 text-sm leading-relaxed">
              {dict.mcp.prereqs.intro}
            </p>
          </div>

          <Step n={1} title={dict.mcp.prereqs.step1Title}>
            <p className="text-gray-400 text-sm mb-2">
              {dict.mcp.prereqs.step1Body1}{' '}
              <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">{dict.mcp.prereqs.step1Body2}</a>
              {' '}{dict.mcp.prereqs.step1Body3} <strong className="text-white">{dict.mcp.prereqs.step1Body4}</strong> {dict.mcp.prereqs.step1Body5} <strong className="text-white">{dict.mcp.prereqs.step1Body6}</strong>.
            </p>
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                {dict.mcp.prereqs.step1Warning}
              </p>
            </div>
          </Step>

          <Step n={2} title={dict.mcp.prereqs.step2Title}>
            <p className="text-gray-400 text-sm mb-2">
              {dict.mcp.prereqs.step2Intro}
            </p>
            <ul className="text-gray-400 text-sm space-y-1.5 list-disc list-inside">
              <li>
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">&lt;YOUR_MCP_TOKEN&gt;</code>{' '}
                {dict.mcp.prereqs.step2Item1}
              </li>
              <li>
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">&lt;YOUR_MCP_URL&gt;</code>{' '}
                {dict.mcp.prereqs.step2Item2a}
                {' '}<code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">http://host:3005/mcp</code>
                {dict.mcp.prereqs.step2Item2b} <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_MCP_URL</code>{' '}
                {dict.mcp.prereqs.step2Item2c}
              </li>
            </ul>
          </Step>
        </Section>

        {/* Claude Code */}
        <Section id="claude-code" icon="⚡" title={dict.mcp.claudeCode.title}>
          <div className="space-y-2 mb-6 text-sm text-gray-400">
            <p>
              {dict.mcp.claudeCode.intro1}{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">.mcp.json</code>{' '}
              {dict.mcp.claudeCode.intro2}{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.claude.json</code>
              {' '}{dict.mcp.claudeCode.intro3}
            </p>
          </div>

          <Step n={1} title={dict.mcp.claudeCode.step1Title}>
            <CodeBlock code={claudeCodeConfig} />
          </Step>

          <Step n={2} title={dict.mcp.claudeCode.step2Title}>
            <p className="text-gray-400 text-sm mb-3">
              {dict.mcp.claudeCode.step2Body}
            </p>
            <CodeBlock code="/mcp" lang="bash" />
            <p className="text-gray-400 text-sm mt-3">
              {dict.mcp.claudeCode.step2Footer(TOOL_COUNT)}
            </p>
          </Step>

          <Step n={3} title={dict.mcp.claudeCode.step3Title}>
            <p className="text-gray-400 text-sm mb-3">{dict.mcp.claudeCode.step3Body}</p>
            <CodeBlock code={'Usa il tool list_projects di roadboard per mostrarmi i progetti disponibili.'} lang="text" />
          </Step>
        </Section>

        {/* Zed */}
        <Section id="zed" icon="🔷" title={dict.mcp.zed.title}>
          <div className="mb-6 text-sm text-gray-400">
            <p>
              {dict.mcp.zed.intro1}{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.config/zed/settings.json</code>
              {' '}{dict.mcp.zed.intro2} <strong className="text-white">{dict.mcp.zed.intro3}</strong>).
            </p>
          </div>

          <Step n={1} title={dict.mcp.zed.step1Title}>
            <CodeBlock code={zedConfigHttp} />
          </Step>

          <Step n={2} title={dict.mcp.zed.step2Title}>
            <p className="text-gray-400 text-sm mb-3">
              {dict.mcp.zed.step2Body}{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">mcp-remote</code>:
            </p>
            <CodeBlock code={zedConfigStdio} />
            <p className="text-gray-400 text-sm mt-3">
              {dict.mcp.zed.step2Footer1} <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">npx</code> {dict.mcp.zed.step2Footer2}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs ml-1">mcp-remote</code>{' '}
              {dict.mcp.zed.step2Footer3}
            </p>
          </Step>

          <Step n={3} title={dict.mcp.zed.step3Title}>
            <p className="text-gray-400 text-sm">
              {dict.mcp.zed.step3Body1}<kbd className="bg-gray-800 border border-gray-600 px-1.5 py-0.5 rounded text-xs">Ctrl+?</kbd>{dict.mcp.zed.step3Body2} {TOOL_COUNT} {dict.mcp.zed.step3Body3}
            </p>
          </Step>
        </Section>

        {/* VS Code */}
        <Section id="vscode" icon="🟦" title={dict.mcp.vscode.title}>
          <div className="mb-6 text-sm text-gray-400">
            <p className="mb-1">{dict.mcp.vscode.introA}</p>
            <p>{dict.mcp.vscode.introB}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-white font-semibold text-base mb-4">{dict.mcp.vscode.systemATitle}</h3>

            <div className="mb-4 space-y-1 text-sm text-gray-400">
              <p>
                <span className="text-gray-300">{dict.mcp.vscode.systemAUserFile}:</span>{' '}
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.config/Code/User/mcp.json</code>
                {' '}
                <span className="text-gray-500 text-xs">{dict.mcp.vscode.systemAUserFileNote}</span>
              </p>
              <p>
                <span className="text-gray-300">{dict.mcp.vscode.systemAWorkspaceFile}:</span>{' '}
                <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">.vscode/mcp.json</code>
                {' '}
                <span className="text-gray-500 text-xs">{dict.mcp.vscode.systemAWorkspaceFileNote}</span>
              </p>
            </div>

            <Step n={1} title={dict.mcp.vscode.step1Title}>
              <CodeBlock code={vsCodeConfig} />
            </Step>

            <Step n={2} title={dict.mcp.vscode.step2Title}>
              <p className="text-gray-400 text-sm">
                {dict.mcp.vscode.step2Body}
              </p>
            </Step>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-white font-semibold text-base mb-3">{dict.mcp.vscode.systemBTitle}</h3>
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-4 text-sm text-indigo-200">
              <p>
                {dict.mcp.vscode.systemBBody}{' '}
                <code className="text-green-400 bg-gray-900/60 px-1.5 py-0.5 rounded text-xs">~/.claude.json</code>.
                {' '}{dict.mcp.vscode.systemBBody2}{' '}
                <a href="#claude-code" className="text-indigo-300 hover:text-indigo-200 underline">
                  {dict.mcp.vscode.systemBBody3}
                </a>
                {' '}{dict.mcp.vscode.systemBBody4}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-700 pt-6">
            <details className="group bg-gray-900 border border-gray-800 rounded-lg open:border-indigo-700 transition-colors">
              <summary className="cursor-pointer list-none flex items-start gap-3 px-4 py-3">
                <span className="text-indigo-400 font-mono text-sm flex-shrink-0 group-open:rotate-90 transition-transform">▶</span>
                <span className="text-white text-sm font-medium flex-1">{dict.mcp.vscode.faqTwoListsTitle}</span>
              </summary>
              <div className="px-4 pb-4 pl-11 text-gray-400 text-sm leading-relaxed">
                {dict.mcp.vscode.faqTwoListsBody}
              </div>
            </details>
          </div>
        </Section>

        {/* Codex CLI */}
        <Section id="codex" icon="🟣" title={dict.mcp.codex.title}>
          <div className="mb-6 text-sm text-gray-400">
            <p className="mb-2">{dict.mcp.codex.intro}</p>
            <p>
              <span className="text-gray-300">{dict.mcp.codex.fileLabel}:</span>{' '}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">~/.codex/config.toml</code>
            </p>
          </div>

          <Step n={1} title={dict.mcp.codex.step1Title}>
            <p className="text-gray-400 text-sm mb-3">
              {dict.mcp.codex.step1Env}
            </p>
            <CodeBlock code={codexEnvSetup} lang="bash" />
            <p className="text-gray-400 text-sm mt-3 mb-3">
              {dict.mcp.codex.step1EnvNote}
            </p>
            <CodeBlock code={codexConfigToml} lang="toml" />
          </Step>

          <Step n={2} title={dict.mcp.codex.step2Title}>
            <p className="text-gray-400 text-sm mb-3">
              {dict.mcp.codex.step2Body}
            </p>
            <CodeBlock code={codexConfigTomlStdio} lang="toml" />
          </Step>

          <Step n={3} title={dict.mcp.codex.step3Title}>
            <p className="text-gray-400 text-sm">
              {dict.mcp.codex.step3Body}
            </p>
          </Step>
        </Section>

        {/* Tool disponibili */}
        <Section id="tools" icon="🛠️" title={dict.mcp.tools.title(TOOL_COUNT)}>
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
        <Section id="protocol" icon="🤖" title={dict.mcp.protocol.title}>
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-5 mb-6">
            <p className="text-indigo-200 text-sm leading-relaxed">
              {dict.mcp.protocol.intro1} <code className="text-green-400 bg-gray-900/60 px-1.5 py-0.5 rounded">initial_instructions</code> {dict.mcp.protocol.intro2} <strong>{dict.mcp.protocol.intro3}</strong> {dict.mcp.protocol.intro4}
            </p>
          </div>

          <Step n={1} title={dict.mcp.protocol.step1Title}>
            <p className="text-gray-400 text-sm mb-3">
              {dict.mcp.protocol.step1Body}
            </p>
            <CodeBlock
              code={`## MCP Operational Protocols\n- **RoadBoard 2.0 MCP**: If tools are available and you have NOT yet called\n  \`initial_instructions()\` in this session, call it IMMEDIATELY — before any\n  other response. It loads the operational protocol, tool catalog and workflow.`}
              lang="markdown"
            />
          </Step>

          <Step n={2} title={dict.mcp.protocol.step2Title}>
            <div className="space-y-2">
              {workflows.map((item) => (
                <div key={item.n} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{item.n}</span>
                  <span className="text-gray-400 text-sm">{item.action}</span>
                </div>
              ))}
            </div>
          </Step>

          <Step n={3} title={dict.mcp.protocol.step3Title}>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <span className="text-gray-400 text-sm">{rule}</span>
                </div>
              ))}
            </div>
          </Step>
        </Section>

        {/* FAQ */}
        <Section id="faq" icon="❓" title={dict.mcp.faq.title}>
          <div className="space-y-4">
            {faqItems.map((item) => (
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
        <Section id="troubleshooting" icon="🔧" title={dict.mcp.troubleshooting.title}>
          <div className="space-y-4">
            {troubleshooting.map((item) => (
              <div key={item.problem} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="text-red-400 font-mono text-sm font-medium mb-1">❌ {item.problem}</p>
                <p className="text-gray-400 text-sm">✅ {item.solution}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer className="pt-8 text-center text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
          <p>{dict.mcp.footer.summary(TOOL_COUNT)}</p>
          <p className="mt-1">
            {dict.mcp.footer.help}{' '}
            <a href="/projects" className="text-indigo-400 hover:text-indigo-300">
              {dict.mcp.footer.backLink}
            </a>
          </p>
        </footer>

      </div>
    </div>
  );
}
