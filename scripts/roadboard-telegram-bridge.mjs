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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// strip internal control leaks (Claude Code harness) for live + final views
function sanitizeLeaks(s) {
  return s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/<\/?system-reminder>/gi, " ")
    .replace(/Available skills \(for Skill tool\):[\s\S]*?(?:\n\s*\n|$)/gi, " ");
}

// mid-stream plain-text view of the accumulated partial (with a cursor)
function liveView(raw) {
  let s = sanitizeLeaks(splitSender(raw || ""))
    .replace(/^\s*_→ (.+?)_\s*$/gm, "🔧 $1")
    .replace(/^\s*↪.*$/gm, "")
    .replace(/\[\[ASK:[a-z0-9_-]+\]\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) return "";
  if (s.length > 3500) s = "…" + s.slice(-3500);
  return s + " ▍";
}

async function tgEdit(chatId, msgId, text, opts = {}) {
  const t = (text && text.trim()) ? text : "…";
  const body = { chat_id: chatId, message_id: msgId, disable_web_page_preview: true };
  body.text = (opts.html ? mdToHtml(t) : t).slice(0, 4096);
  if (opts.html) body.parse_mode = "HTML";
  const r = await tg("editMessageText", body);
  if (r && r.ok === false) {
    const d = r.description || "";
    console.error("[tg] edit fail", r.error_code, d.slice(0,80));
    if (/not modified/i.test(d)) return { ok: true };
    if (r.error_code === 429) { await sleep(((r.parameters && r.parameters.retry_after) || 2) * 1000); return tgEdit(chatId, msgId, text, opts); }
    if (opts.html) return tg("editMessageText", { chat_id: chatId, message_id: msgId, text: t.slice(0, 4096), disable_web_page_preview: true });
  }
  return r;
}

function splitSender(raw) {
  if (raw.startsWith("\x1e")) { const nl = raw.indexOf("\n"); return nl === -1 ? "" : raw.slice(nl + 1); }
  return raw;
}

async function rb(pathname, opts = {}) {
  return fetch(`${RB_API}${pathname}`, { ...opts, headers: { Authorization: `Bearer ${RB_TOKEN}`, ...(opts.headers || {}) } });
}

// Deterministic domain routing: segreteria (email/inbox/calendar/reminders) -> Cleo,
// so it never depends on the assistant flakily delegating via [[ASK:cleo]].
const INBOX_RE = /\b(e[-\s]?mail|mail|posta|inbox|casella|gmail|promemoria|reminder|calendario|appuntament|bozz[ae]|draft)\b/i;

// run one turn and return the assistant's reply text
async function runTurn(message, onProgress) {
  let slug = "assistant";
  let text = message;
  const m = message.match(/^[@/]([a-z0-9_-]+)\s+([\s\S]+)$/i);
  if (m) { slug = m[1].toLowerCase(); text = m[2]; }
  else if (INBOX_RE.test(message)) { slug = "cleo"; }  // segreteria -> Cleo (deterministic)
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
  // strip leaked internal control text (Claude Code harness injections) so it can
  // never reach the user as the reply: <system-reminder> blocks and the Skill-tool
  // "Available skills (for Skill tool): ..." enumeration.
  s = s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/<\/?system-reminder>/gi, " ")
    .replace(/Available skills \(for Skill tool\):[\s\S]*?(?:\n\s*\n|$)/gi, " ");
  let t = s
    .split("\n")
    .filter((l) => !/^\s*_→ .*_\s*$/.test(l))
    .join("\n")
    .replace(/\[\[ASK:[a-z0-9_-]+\]\]/gi, "");
  // drop leading "thinking-out-loud" paragraphs (English meta) before the real answer
  const meta = /\b(let me|i should|i'?ll|i will|i need to|the user|i don'?t|i do not|i can'?t|we already|note (that|the)|as vera|let'?s|i'?m going to|first,? |looking at the|continue the loop)\b/i;
  const paras = t.split(/\n\s*\n/);
  let i = 0;
  while (i < paras.length - 1 && meta.test(paras[i])) i++;
  let out = paras.slice(i).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  // also drop leading meta SENTENCES (inline/glued, es. "Let me recall.Dalla…")
  const sent = out.split(/(?<=[.?!])\s+|(?<=[.?!])(?=[A-ZÀ-Ÿ])/);
  let j = 0;
  while (j < sent.length - 1 && meta.test(sent[j]) && sent[j].length < 240) j++;
  if (j > 0) out = sent.slice(j).join(" ").trim();
  return out;
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
  // Stream the answer into a single message: create it on the FIRST streamed text and edit
  // it in place (~1s); final edit is the clean HTML answer. Native typing is also sent (shows
  // on clients that render bot typing in 1:1 chats).
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  let typing = setInterval(() => tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {}), 4000);
  const stopTyping = () => { if (typing) { clearInterval(typing); typing = null; } };
  let msgId = null, latest = "", lastSent = "", busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    const view = liveView(latest);
    if (!view || view === lastSent) return;
    busy = true;
    try {
      if (!msgId) {
        const m = await tg("sendMessage", { chat_id: chatId, text: view.slice(0, 4096), disable_web_page_preview: true });
        if (m && m.ok) { msgId = m.result.message_id; lastSent = view; }
      } else {
        lastSent = view;
        await tgEdit(chatId, msgId, view, { html: false });
      }
    } catch { /* best-effort */ }
    busy = false;
  }, 1000);
  const onProgress = (partial) => { latest = partial || ""; };
  try {
    const reply = await runTurn(msg.text.trim(), onProgress);
    clearInterval(timer); stopTyping();
    const clean = reply && reply.trim() ? reply : "(nessuna risposta)";
    if (!msgId) { await sendMessage(chatId, clean); }
    else if (clean.length <= 4096) { await tgEdit(chatId, msgId, clean, { html: true }); }
    else { await tgEdit(chatId, msgId, clean.slice(0, 3500) + " …", { html: true }); await sendMessage(chatId, clean.slice(3500)); }
  } catch (e) {
    clearInterval(timer); stopTyping();
    const err = "[errore] " + (e instanceof Error ? e.message : String(e));
    if (msgId) await tgEdit(chatId, msgId, err, { html: false }).catch(() => {}); else await sendMessage(chatId, err);
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
