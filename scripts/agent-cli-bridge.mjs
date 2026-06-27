#!/usr/bin/env node
// life-OS agent CLI bridge: runs subscription CLIs (claude-code/codex) on the HOST
// and streams stdout. core-api (container) calls this via host.docker.internal.
// SECURITY: this executes the local CLI with caller-provided prompts. Bind to a
// trusted interface and set AGENT_CLI_BRIDGE_TOKEN to require a bearer token.
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.AGENT_CLI_BRIDGE_PORT || 8787);
const TOKEN = process.env.AGENT_CLI_BRIDGE_TOKEN || '';
if (!TOKEN) { console.error('AGENT_CLI_BRIDGE_TOKEN is required (refusing to run without auth)'); process.exit(1); }
function bearerOk(header) {
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  const given = Buffer.from(typeof header === 'string' ? header : '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
const CLAUDE_BIN = process.env.CLAUDE_BIN || [process.env.HOME + '/.local/bin/claude', '/usr/local/bin/claude', '/usr/bin/claude'].find((c) => { try { return require('node:fs').existsSync(c); } catch { return false; } }) || 'claude';
const BIN = { 'claude-code': CLAUDE_BIN, codex: 'codex' };
// per-request tool policy by trust tier (fail-closed: unknown => restricted).
// destructive shell prefixes are HARD-BLOCKED for sysadmin (interim for "confirm on dangerous").
const DANGEROUS_BASH = ['rm','sudo','dd','mkfs','shutdown','reboot','kill','pkill','killall','chmod','chown','mv','docker','systemctl','git push','truncate'];
function claudeDisallowed(policy, repoRw) {
  if (policy === 'sysadmin') return ['WebFetch', 'WebSearch', 'Task', ...DANGEROUS_BASH.map((c) => `Bash(${c}:*)`)];
  if (policy === 'auditor') {
    // read-only code auditor (e.g. Argo): may read/navigate code but never edit,
    // run shell, fetch the web, or spawn tasks. Proposes changes to dev (Ada).
    return ['Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite'];
  }
  if (policy === 'dev') {
    // dev on a project repo (rw): git is allowed (commit on the user's explicit
    // request — see git-conventions skill) but push + dangerous shell stay blocked.
    // ssh/curl/wget are denied too, to neutralize broad user-scope settings.json allows.
    if (repoRw) return ['WebFetch', 'WebSearch', 'Task', ...DANGEROUS_BASH.map((c) => `Bash(${c}:*)`), 'Bash(ssh:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(npx:*)'];
    return ['Bash', 'WebFetch', 'WebSearch', 'Task'];
  }
  return ['Bash', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite'];
}
// RoadBoard MCP per-agent access (slug derived from cwd). Read tool list enumerated
// 2026-06-26 from the company MCP (10.4.0.23); re-check on a new RoadBoard release.
const RB_READ = ['initial_instructions','list_projects','list_teams','get_user','get_project','list_active_tasks','list_phases','get_project_memory','prepare_task_context','prepare_project_summary','list_recent_decisions','get_project_changelog','search_memory','get_architecture_map','get_node_context','get_architecture_snapshot','list_scheduled_activities'];
// RB access levels: 'full' (all tools) | 'archive' (read + persist artifacts via
// create_memory_entry/create_handoff) | 'read' (read-only) | 'none'.
const RB_ACCESS = { dev: 'full', researcher: 'archive', grafico: 'archive', sysadmin: 'read', argo: 'read',
  sofia: 'archive', william: 'archive', leonardo: 'archive', marco: 'archive', amerigo: 'archive', salvo: 'archive', tullio: 'archive', cleo: 'archive' };
const RB_ARCHIVE_WRITE = ['create_memory_entry', 'create_handoff', 'notify', 'read_inbox'];
// All write/mutating RoadBoard tools. For MCP tools claude's allow-list does NOT
// default-deny the rest, so read/archive levels must DENY these explicitly (deny
// is enforced) to guarantee read-only / archive-only access.
const RB_WRITE = ['create_task','update_task','update_task_status','delete_task','create_phase','update_phase','create_memory_entry','create_handoff','create_decision','update_decision','create_project','ingest_architecture','create_architecture_repository','create_architecture_node','create_architecture_edge','create_architecture_link','create_architecture_annotation','link_task_to_node','create_scheduled_activity','pause_scheduled_activity','delete_scheduled_activity','notify','read_inbox'];
function roadboardToolFlags(slug, disallowed, hasLocalMcp, extraAllowed) {
  const allowed = [...(extraAllowed || [])];
  const level = RB_ACCESS[slug] || 'none';
  // only grant roadboard tools when we have the LOCAL mcp-config wired; otherwise
  // block it so the agent can never fall back to a user-scope (company) server.
  if (level !== 'none' && hasLocalMcp) {
    if (level === 'full') {
      allowed.push('mcp__roadboard');
    } else {
      const writeAllow = level === 'archive' ? RB_ARCHIVE_WRITE : [];
      for (const t of RB_READ) allowed.push('mcp__roadboard__' + t);
      for (const t of writeAllow) allowed.push('mcp__roadboard__' + t);
      // explicit deny of every write tool not granted at this level
      for (const t of RB_WRITE) if (!writeAllow.includes(t)) disallowed.push('mcp__roadboard__' + t);
    }
  } else {
    disallowed.push('mcp__roadboard');
  }
  const flags = [];
  if (allowed.length) flags.push('--allowedTools', ...allowed);
  flags.push('--disallowedTools', ...disallowed);
  return flags;
}
const WS_BASE = process.env.AGENT_CLI_BRIDGE_WS_BASE || '/home/alessio/agent-workspaces';
// Methodology skills the agents may load. Symlinked into each request cwd as the
// project .claude/skills, and loaded via --setting-sources project so agents do
// NOT inherit the user's personal ~/.claude skills/settings.
const AGENT_SKILLS_DIR = process.env.AGENT_SKILLS_DIR || ((process.env.HOME || '/home/alessio') + '/.config/roadboard-agents/skills');
// Shared per-project repo clone (T0.2): ONE clone per project, outside any working tree.
// Ada (dev) = rw and may commit on explicit user request; readers (e.g. security) = ro on the same path.
const REPOS_BASE = process.env.AGENT_REPOS_BASE || ((process.env.HOME || '/home/alessio') + '/agent-repos');
const REPO_ACCESS = { dev: 'rw', argo: 'ro', tullio: 'ro' }; // argo (audit) + tullio (docs) read the clone, no write
function ensureProjectRepo(projectId, repoUrl) {
  if (!projectId || !repoUrl) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) return null; // safe dir name
  const dir = path.join(REPOS_BASE, projectId);
  try {
    fs.mkdirSync(REPOS_BASE, { recursive: true });
    if (fs.existsSync(path.join(dir, '.git'))) {
      try { execFileSync('git', ['-C', dir, 'pull', '--ff-only'], { stdio: 'ignore', timeout: 60000 }); } catch (e) { /* keep stale clone */ }
    } else {
      execFileSync('git', ['clone', '--depth', '1', String(repoUrl), dir], { stdio: 'ignore', timeout: 120000 });
    }
    // Disable push at the DATA layer: claude's Bash permission matching is prefix-based,
    // so `git -C <path> push` slips past a `Bash(git push:*)` deny. Setting an invalid
    // push URL makes any push form fail. Commits stay local (commit-on-request); pushing
    // is a separate, deliberate grant we do NOT give the agent.
    try { execFileSync('git', ['-C', dir, 'remote', 'set-url', '--push', 'origin', 'DISABLED_NO_PUSH'], { stdio: 'ignore', timeout: 15000 }); } catch (e) { /* best-effort */ }
    return dir;
  } catch (e) { console.error('[repo-ensure]', e.message); return null; }
}

const handler = (req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/run')) {
    res.writeHead(404); return res.end('not found');
  }
  if (!bearerOk(req.headers.authorization)) {
    res.writeHead(401); return res.end('unauthorized');
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let p;
    try { p = JSON.parse(body || '{}'); } catch { res.writeHead(400); return res.end('bad json'); }
    const bin = BIN[p.provider || 'claude-code'];
    if (!bin) { res.writeHead(400); return res.end('unknown provider'); }
    let reqCwd = (typeof p.cwd === 'string' && p.cwd) ? path.resolve(p.cwd) : null;
    if (reqCwd && !(reqCwd === WS_BASE || reqCwd.startsWith(WS_BASE + '/'))) {
      res.writeHead(400); return res.end('cwd not allowed');
    }
    const prompt = String(p.prompt || '');
    // NOTE: codex tiering not yet implemented; privileged agents must use claude-code.
    const policy = (p.toolPolicy === 'sysadmin' || p.toolPolicy === 'dev' || p.toolPolicy === 'auditor') ? p.toolPolicy : 'restricted';
    const slug = reqCwd ? path.basename(reqCwd) : '';
    const rbLevel = RB_ACCESS[slug] || 'none';
    const repoAccess = REPO_ACCESS[slug] || 'none';
    console.error("[run-dbg]", JSON.stringify({ slug: slug, rbLevel: rbLevel, hasMcpUrl: !!p.roadboardMcpUrl, hasMcpTok: !!p.roadboardMcpToken, hasRepoUrl: !!p.repoUrl, projectId: p.projectId || null, source: p.source || null }));
    let repoPath = null;
    if (repoAccess !== 'none' && p.projectId && p.repoUrl) repoPath = ensureProjectRepo(String(p.projectId), String(p.repoUrl));
    let mcpFlags = [];
    if (rbLevel !== 'none' && reqCwd && p.roadboardMcpUrl && p.roadboardMcpToken) {
      try {
        const cfgPath = path.join(reqCwd, '.rb-mcp.json');
        fs.writeFileSync(cfgPath, JSON.stringify({ mcpServers: { roadboard: { type: 'http', url: String(p.roadboardMcpUrl), headers: { Authorization: 'Bearer ' + String(p.roadboardMcpToken) } } } }), { mode: 0o600 });
        mcpFlags = ['--mcp-config', cfgPath, '--strict-mcp-config'];
      } catch (e) { /* fall back to no roadboard access */ }
    }
    const repoRw = repoAccess === 'rw' && !!repoPath;
    const toolFlags = roadboardToolFlags(slug, claudeDisallowed(policy, repoRw), mcpFlags.length > 0, repoRw ? ['Bash(git:*)'] : []);
    const streamMode = !!p.stream && p.provider !== 'codex';
    const args = (p.provider === 'codex')
      ? ['exec', prompt]
      : ['-p', prompt, '--output-format', streamMode ? 'stream-json' : 'text', ...(streamMode ? ['--verbose'] : []), '--setting-sources', 'project', ...(p.model ? ['--model', String(p.model)] : []), ...toolFlags, ...mcpFlags];
    if (reqCwd && typeof p.contextMd === 'string') {
      try {
        fs.mkdirSync(reqCwd, { recursive: true });
        const _ctx = p.contextMd + (repoPath ? ('\n\n## Repo del progetto\nIl repository del progetto e clonato in: ' + repoPath + ' (accesso ' + repoAccess + '). Lavora lì con path assoluti; non toccare altri percorsi del sistema.') : '');
        fs.writeFileSync(path.join(reqCwd, 'CLAUDE.md'), _ctx);
        // project-scope skills: only the methodology set, never the user's personal skills
        const cdir = path.join(reqCwd, '.claude'); fs.mkdirSync(cdir, { recursive: true });
        const slink = path.join(cdir, 'skills');
        try { fs.unlinkSync(slink); } catch {}
        try { fs.symlinkSync(AGENT_SKILLS_DIR, slink); } catch {}
        const ag = path.join(reqCwd, 'AGENTS.md');
        try { fs.unlinkSync(ag); } catch {}
        try { fs.symlinkSync('CLAUDE.md', ag); } catch {}
      } catch (e) { /* best-effort */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const child = spawn(bin, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], cwd: reqCwd || (process.env.AGENT_CLI_BRIDGE_CWD || process.cwd()) });
    if (streamMode) {
      let buf = '';
      child.stdout.on('data', (d) => {
        buf += d.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
            for (const b of ev.message.content) {
              if (b && b.type === 'tool_use' && b.name) {
                const nm = String(b.name).replace(/^mcp__roadboard__/, 'roadboard:').replace(/^mcp__/, '');
                res.write('\n_\u2192 ' + nm + '_\n');
              }
            }
          } else if (ev.type === 'result' && typeof ev.result === 'string') {
            res.write('\n' + ev.result);
          }
        }
      });
    } else {
      child.stdout.on('data', (d) => res.write(d));
    }
    child.stderr.on('data', (d) => console.error('[child-stderr]', String(d)));
    child.on('error', (e) => { res.write(`\n[bridge-error] ${e.message}`); res.end(); });
    child.on('close', (code) => { console.error('[child-close]', code); res.end(); });
    res.on('close', () => { try { child.kill(); } catch {} });
  });
};
const HOSTS = (process.env.AGENT_CLI_BRIDGE_HOSTS || '127.0.0.1,172.17.0.1').split(',').map((x) => x.trim()).filter(Boolean);
if (HOSTS.includes('0.0.0.0')) { console.error('refusing to bind 0.0.0.0 (LAN exposure); set AGENT_CLI_BRIDGE_HOSTS to specific interfaces'); process.exit(1); }
for (const h of HOSTS) http.createServer(handler).listen(PORT, h, () => console.log(`agent-cli-bridge listening on ${h}:${PORT}`));
