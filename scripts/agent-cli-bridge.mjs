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
function claudeDisallowed(policy) {
  if (policy === 'sysadmin') return ['WebFetch', 'WebSearch', 'Task', ...DANGEROUS_BASH.map((c) => `Bash(${c}:*)`)];
  if (policy === 'dev') return ['Bash', 'WebFetch', 'WebSearch', 'Task'];
  return ['Bash', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite'];
}
// RoadBoard MCP per-agent access (slug derived from cwd). Read tool list enumerated
// 2026-06-26 from the company MCP (10.4.0.23); re-check on a new RoadBoard release.
const RB_READ = ['initial_instructions','list_projects','list_teams','get_user','get_project','list_active_tasks','list_phases','get_project_memory','prepare_task_context','prepare_project_summary','list_recent_decisions','get_project_changelog','search_memory','get_architecture_map','get_node_context','get_architecture_snapshot'];
const RB_ACCESS = { dev: 'full', researcher: 'read', sysadmin: 'read' };
function roadboardToolFlags(slug, disallowed, hasLocalMcp) {
  const allowed = [];
  const level = RB_ACCESS[slug] || 'none';
  // only grant roadboard tools when we have the LOCAL mcp-config wired; otherwise
  // block it so the agent can never fall back to a user-scope (company) server.
  if (level !== 'none' && hasLocalMcp) {
    if (level === 'full') allowed.push('mcp__roadboard');
    else for (const t of RB_READ) allowed.push('mcp__roadboard__' + t);
  } else {
    disallowed.push('mcp__roadboard');
  }
  const flags = [];
  if (allowed.length) flags.push('--allowedTools', ...allowed);
  flags.push('--disallowedTools', ...disallowed);
  return flags;
}
const WS_BASE = process.env.AGENT_CLI_BRIDGE_WS_BASE || '/home/alessio/agent-workspaces';
// Shared per-project repo clone (T0.2): ONE clone per project, outside any working tree.
// Ada (dev) = rw and may commit on explicit user request; readers (e.g. security) = ro on the same path.
const REPOS_BASE = process.env.AGENT_REPOS_BASE || ((process.env.HOME || '/home/alessio') + '/agent-repos');
const REPO_ACCESS = { dev: 'rw' }; // readers (argo, ...) added when they exist as agents
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
    const policy = (p.toolPolicy === 'sysadmin' || p.toolPolicy === 'dev') ? p.toolPolicy : 'restricted';
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
    const toolFlags = roadboardToolFlags(slug, claudeDisallowed(policy), mcpFlags.length > 0);
    const streamMode = !!p.stream && p.provider !== 'codex';
    const args = (p.provider === 'codex')
      ? ['exec', prompt]
      : ['-p', prompt, '--output-format', streamMode ? 'stream-json' : 'text', ...(streamMode ? ['--verbose'] : []), ...(p.model ? ['--model', String(p.model)] : []), ...toolFlags, ...mcpFlags];
    if (reqCwd && typeof p.contextMd === 'string') {
      try {
        fs.mkdirSync(reqCwd, { recursive: true });
        const _ctx = p.contextMd + (repoPath ? ('\n\n## Repo del progetto\nIl repository del progetto e clonato in: ' + repoPath + ' (accesso ' + repoAccess + '). Lavora lì con path assoluti; non toccare altri percorsi del sistema.') : '');
        fs.writeFileSync(path.join(reqCwd, 'CLAUDE.md'), _ctx);
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
