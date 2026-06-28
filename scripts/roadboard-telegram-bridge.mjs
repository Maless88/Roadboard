#!/usr/bin/env node
// RoadBoard Telegram bridge (slice 1): single bot = the "assistant" front.
// Inbound: long-poll getUpdates -> run a turn in the user's direct room with the
// target agent (default: assistant; "@slug ..." or "/slug ..." targets another) ->
// reply to Telegram. Outbound: local HTTP POST /send for the notification hub.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV_PATH = process.env.RB_TG_ENV || path.join(os.homedir(), ".config/roadboard/telegram-bot.env");
function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = loadEnv(ENV_PATH);
const TOKEN = (env.TELEGRAM_BOT_TOKEN || "").trim();
const RB_API = (env.RB_API_URL || "http://127.0.0.1:3001").trim();
const RB_TOKEN = (env.RB_API_TOKEN || "").trim();
const NOTIFY_TOKEN = (env.NOTIFY_TOKEN || "").trim();
const ALLOWED = (env.ALLOWED_TELEGRAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT_PORT = Number(env.RB_TG_OUT_PORT || 8788);
const STATE = path.join(os.homedir(), ".config/roadboard/telegram-state.json");

if (!TOKEN) { console.error("[tg] TELEGRAM_BOT_TOKEN missing in " + ENV_PATH); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;

function readState() { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { offset: 0, lastChat: null }; } }
function writeState(s) { try { fs.writeFileSync(STATE, JSON.stringify(s), { mode: 0o600 }); } catch { /* ignore */ } }
let state = readState();

async function tg(method, body) {
  const r = await fetch(`${API}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
function escHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
// Minimal Markdown -> Telegram-HTML (allowed tags: b,i,code,pre,a). Best-effort; we
// fall back to plain text if Telegram rejects the parse.
function mdToHtml(md) {
  md = escHtml(md);
  md = md.replace(/```[a-z0-9]*\n?([\s\S]*?)```/gi, (_, c) => `<pre>${c}</pre>`);
  md = md.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  md = md.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/__([^_\n]+)__/g, "<b>$1</b>");
  md = md.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  md = md.replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>");
  md = md.replace(/^\s*[-*]\s+/gm, "\u2022 ");
  return md;
}

async function sendMessage(chatId, text) {
  const t = text && text.trim() ? text : "(nessuna risposta)";
  for (let i = 0; i < t.length; i += 3500) {
    const chunk = t.slice(i, i + 3500);
    const r = await tg("sendMessage", { chat_id: chatId, text: mdToHtml(chunk), parse_mode: "HTML", disable_web_page_preview: true });
    if (!r || r.ok === false) {
      await tg("sendMessage", { chat_id: chatId, text: chunk, disable_web_page_preview: true }); // plain fallback
    }
  }
}

function splitSender(raw) {
  if (raw.startsWith("\x1e")) { const nl = raw.indexOf("\n"); return nl === -1 ? "" : raw.slice(nl + 1); }
  return raw;
}

async function rb(pathname, opts = {}) {
  return fetch(`${RB_API}${pathname}`, { ...opts, headers: { Authorization: `Bearer ${RB_TOKEN}`, ...(opts.headers || {}) } });
}

// run one turn and return the assistant's reply text
async function runTurn(message, onProgress) {
  let slug = "assistant";
  let text = message;
  const m = message.match(/^[@/]([a-z0-9_-]+)\s+([\s\S]+)$/i);
  if (m) { slug = m[1].toLowerCase(); text = m[2]; }
  const dr = await rb("/agents/rooms/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: slug }) });
  if (!dr.ok) throw new Error(`direct room ${dr.status}`);
  const room = await dr.json();
  const res = await rb(`/agents/rooms/${room.id}/turn?message=${encodeURIComponent(text)}`, { headers: { Accept: "text/event-stream" } });
  if (!res.ok || !res.body) throw new Error(`turn ${res.status}`);
  // core-api streams SSE: an event with {senderKind,...} JSON, then text events, then "[DONE]".
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "", curr = [];
  const flush = () => {
    if (!curr.length) return;
    const val = curr.join("\n"); curr = [];
    if (val === "[DONE]") return;
    out += val;
    if (onProgress) { try { onProgress(splitSender(out)); } catch { /* best-effort */ } }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, ""); buf = buf.slice(nl + 1);
      if (line === "") { flush(); continue; }
      if (line.startsWith("data:")) { let p = line.slice(5); if (p.startsWith(" ")) p = p.slice(1); curr.push(p); }
    }
  }
  flush();
  return cleanReply(splitSender(out));
}

// strip stream artifacts that shouldn't reach the user: `_→ tool_` action lines,
// [[ASK:slug]] delegation tokens, and collapse the resulting blank lines.
function cleanReply(s) {
  let t = s
    .split("\n")
    .filter((l) => !/^\s*_→ .*_\s*$/.test(l))
    .join("\n")
    .replace(/\[\[ASK:[a-z0-9_-]+\]\]/gi, "");
  // drop leading "thinking-out-loud" paragraphs (English meta) before the real answer
  const meta = /\b(let me|i should|i'?ll|i will|i need to|the user|i don'?t|i do not|i can'?t|we already|note (that|the)|as vera|let'?s|i'?m going to|first,? )\b/i;
  const paras = t.split(/\n\s*\n/);
  let i = 0;
  while (i < paras.length - 1 && meta.test(paras[i])) i++;
  return paras.slice(i).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function handleUpdate(u) {
  const msg = u.message || u.edited_message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const fromId = String(msg.from?.id ?? "");
  if (ALLOWED.length && !ALLOWED.includes(fromId)) {
    await sendMessage(chatId, "Non sei autorizzato a usare questo bot.");
    return;
  }
  state.lastChat = chatId; writeState(state);
  console.error(`[tg] in from ${fromId} chat ${chatId}: ${msg.text.slice(0, 80)}`);
  // Method A: keep a live "typing…" indicator for the whole turn, post each agent
  // step (`_→ tool_`) as its own message as it happens, then a final message with the
  // clean answer. Pure presentation over the same stream — no extra model tokens.
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  let typing = setInterval(() => tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {}), 4000);
  const stopTyping = () => { if (typing) { clearInterval(typing); typing = null; } };
  let queue = Promise.resolve();                   // serialize sends so steps keep their order
  const enqueue = (fn) => { queue = queue.then(fn).catch(() => {}); };
  let emitted = 0;
  const onProgress = (partial) => {
    const steps = [...(partial || "").matchAll(/^\s*_→ (.+?)_\s*$/gm)].map((m) => m[1].trim());
    for (; emitted < steps.length; emitted++) {
      const tool = steps[emitted];
      enqueue(() => tg("sendMessage", { chat_id: chatId, text: `🔧 <i>${escHtml(tool)}</i>`, parse_mode: "HTML", disable_web_page_preview: true }));
    }
  };
  try {
    const reply = await runTurn(msg.text.trim(), onProgress);
    await queue;                                    // flush queued step messages first
    stopTyping();
    const clean = reply && reply.trim() ? reply : (emitted ? "" : "(nessuna risposta)");
    if (clean.trim()) await sendMessage(chatId, clean);
  } catch (e) {
    stopTyping();
    await sendMessage(chatId, `[errore] ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    stopTyping();
  }
}

async function poll() {
  for (;;) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=25&offset=${state.offset}`, { signal: AbortSignal.timeout(35000) });
      const j = await r.json();
      if (j.ok && Array.isArray(j.result)) {
        for (const u of j.result) {
          state.offset = u.update_id + 1;
          await handleUpdate(u);
        }
        if (j.result.length) writeState(state);
      }
    } catch (e) {
      console.error("[tg] poll error:", e instanceof Error ? e.message : String(e));
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

// outbound: POST /send {text, chatId?} (Bearer NOTIFY_TOKEN) -> Telegram. For the notification hub.
http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.startsWith("/send")) { res.writeHead(404); return res.end("not found"); }
  if (NOTIFY_TOKEN && req.headers.authorization !== `Bearer ${NOTIFY_TOKEN}`) { res.writeHead(401); return res.end("unauthorized"); }
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const p = JSON.parse(body || "{}");
      const chatId = p.chatId || state.lastChat;
      if (!chatId) { res.writeHead(400); return res.end("no chatId (no inbound message seen yet)"); }
      await sendMessage(chatId, String(p.text || ""));
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(500); res.end(String(e instanceof Error ? e.message : e)); }
  });
}).listen(OUT_PORT, "0.0.0.0", () => console.error(`[tg] outbound /send on :${OUT_PORT}`));

console.error(`[tg] RoadBoard Telegram bridge up (api=${RB_API}, allow=${ALLOWED.length ? ALLOWED.join(",") : "all"})`);
poll();
