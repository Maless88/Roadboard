#!/usr/bin/env node
// Deploy the versioned agent-skills (packages/agent-skills/<name>/SKILL.md) to the
// host skills dir read by the bridge's `claude` CLI (~/.claude/skills), and
// optionally sync the RoadBoard skills catalog via the local MCP service.
//
//   node scripts/deploy-agent-skills.mjs            # copy files to ~/.claude/skills
//   RB_MCP_TOKEN=<token> node scripts/deploy-agent-skills.mjs   # + sync catalog via MCP
//
// RB_MCP_URL defaults to http://127.0.0.1:3005/mcp (the local roadboard MCP).
import { readFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "packages", "agent-skills");
const DEST = join(homedir(), ".claude", "skills");

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (mm) out[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

if (!existsSync(SRC)) {
  console.error(`No skills package at ${SRC}`);
  process.exit(1);
}

const skills = [];
for (const name of readdirSync(SRC)) {
  const skillFile = join(SRC, name, "SKILL.md");
  if (!existsSync(skillFile) || !statSync(join(SRC, name)).isDirectory()) continue;
  const md = readFileSync(skillFile, "utf8");
  const fm = parseFrontmatter(md);
  const skillName = fm.name || name;
  // deploy to host
  const destDir = join(DEST, skillName);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(skillFile, join(destDir, "SKILL.md"));
  skills.push({ name: skillName, description: fm.description || "" });
  console.log(`deployed: ${skillName} -> ${join(destDir, "SKILL.md")}`);
}

console.log(`\n${skills.length} skill(s) deployed to ${DEST}`);

const token = process.env.RB_MCP_TOKEN;
if (!token) {
  console.log("\n[catalog] RB_MCP_TOKEN not set — skipping RoadBoard catalog sync.");
  console.log("[catalog] To sync: RB_MCP_TOKEN=<token> node scripts/deploy-agent-skills.mjs");
  process.exit(0);
}

const URL = process.env.RB_MCP_URL || "http://127.0.0.1:3005/mcp";
let id = 0;
async function rpc(method, params) {
  id += 1;
  const body = { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) };
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (text.trimStart().startsWith("{")) return JSON.parse(text);
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      try { return JSON.parse(t.slice(5).trim()); } catch { /* ignore */ }
    }
  }
  return null;
}

await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "deploy-agent-skills", version: "1" } });
try { await rpc("notifications/initialized"); } catch { /* ignore */ }
const r = await rpc("tools/call", { name: "sync_skills_catalog", arguments: { skills } });
const out = r?.result;
const txt = (out?.content || []).map((c) => c.text || "").join("");
if (out?.isError) {
  console.error("[catalog] sync_skills_catalog FAILED:", txt.slice(0, 300));
  process.exit(1);
}
console.log("[catalog] RoadBoard catalog synced via MCP:", txt.slice(0, 200));
