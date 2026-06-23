#!/usr/bin/env node
// life-OS agent CLI bridge: runs subscription CLIs (claude-code/codex) on the HOST
// and streams stdout. core-api (container) calls this via host.docker.internal.
// SECURITY: this executes the local CLI with caller-provided prompts. Bind to a
// trusted interface and set AGENT_CLI_BRIDGE_TOKEN to require a bearer token.
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.AGENT_CLI_BRIDGE_PORT || 8787);
const TOKEN = process.env.AGENT_CLI_BRIDGE_TOKEN || '';
const BIN = { 'claude-code': 'claude', codex: 'codex' };
// per-request tool policy by trust tier (fail-closed: unknown => restricted).
// destructive shell prefixes are HARD-BLOCKED for sysadmin (interim for "confirm on dangerous").
const DANGEROUS_BASH = ['rm','sudo','dd','mkfs','shutdown','reboot','kill','pkill','killall','chmod','chown','mv','docker','systemctl','git push','truncate'];
function claudeToolArgs(policy) {
  if (policy === 'sysadmin') {
    return ['--disallowedTools', 'WebFetch', 'WebSearch', 'Task', ...DANGEROUS_BASH.map((c) => `Bash(${c}:*)`)];
  }
  if (policy === 'dev') {
    return ['--disallowedTools', 'Bash', 'WebFetch', 'WebSearch', 'Task'];
  }
  return ['--disallowedTools', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite'];
}
const WS_BASE = process.env.AGENT_CLI_BRIDGE_WS_BASE || '/home/alessio/agent-workspaces';

http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/run')) {
    res.writeHead(404); return res.end('not found');
  }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
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
    const args = (p.provider === 'codex')
      ? ['exec', prompt]
      : ['-p', prompt, '--output-format', 'text', ...(p.model ? ['--model', String(p.model)] : []), ...claudeToolArgs(policy)];
    if (reqCwd && typeof p.contextMd === 'string') {
      try {
        fs.mkdirSync(reqCwd, { recursive: true });
        fs.writeFileSync(path.join(reqCwd, 'CLAUDE.md'), p.contextMd);
        const ag = path.join(reqCwd, 'AGENTS.md');
        try { fs.unlinkSync(ag); } catch {}
        try { fs.symlinkSync('CLAUDE.md', ag); } catch {}
      } catch (e) { /* best-effort */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const child = spawn(bin, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], cwd: reqCwd || (process.env.AGENT_CLI_BRIDGE_CWD || process.cwd()) });
    child.stdout.on('data', (d) => res.write(d));
    child.stderr.on('data', (d) => console.error('[child-stderr]', String(d)));
    child.on('error', (e) => { res.write(`\n[bridge-error] ${e.message}`); res.end(); });
    child.on('close', (code) => { console.error('[child-close]', code); res.end(); });
    res.on('close', () => { try { child.kill(); } catch {} });
  });
}).listen(PORT, '0.0.0.0', () => console.log(`agent-cli-bridge listening on :${PORT}`));
