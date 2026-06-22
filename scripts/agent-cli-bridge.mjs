#!/usr/bin/env node
// life-OS agent CLI bridge: runs subscription CLIs (claude-code/codex) on the HOST
// and streams stdout. core-api (container) calls this via host.docker.internal.
// SECURITY: this executes the local CLI with caller-provided prompts. Bind to a
// trusted interface and set AGENT_CLI_BRIDGE_TOKEN to require a bearer token.
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.AGENT_CLI_BRIDGE_PORT || 8787);
const TOKEN = process.env.AGENT_CLI_BRIDGE_TOKEN || '';
const BIN = { 'claude-code': 'claude', codex: 'codex' };

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
    const prompt = String(p.prompt || '');
    const args = (p.provider === 'codex')
      ? ['exec', prompt]
      : ['-p', prompt, ...(p.model ? ['--model', String(p.model)] : [])];
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const child = spawn(bin, args, { env: process.env });
    child.stdout.on('data', (d) => res.write(d));
    child.stderr.on('data', () => {});
    child.on('error', (e) => { res.write(`\n[bridge-error] ${e.message}`); res.end(); });
    child.on('close', () => res.end());
    req.on('close', () => { try { child.kill(); } catch {} });
  });
}).listen(PORT, '0.0.0.0', () => console.log(`agent-cli-bridge listening on :${PORT}`));
