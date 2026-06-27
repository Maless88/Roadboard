#!/usr/bin/env python3
"""RoadBoard email helper (host). Read-only inbox peek + explicit mark-as-read + save-draft for Cleo.
GET  /inbox?account=aruba&limit=N           -> JSON [{uid,message_id,from,subject,date,unread,snippet}] (BODY.PEEK, stays unread)
POST /mark_read {account, uids:[...]}        -> set \\Seen on those UIDs (explicit, on user request)
POST /draft {account,to,subject,body,cc?,in_reply_to?} -> save a message in Drafts (NEVER sends; user reviews & sends)
Bearer EMAIL_HELPER_TOKEN. Creds from ~/.config/roadboard/email-accounts.env. Builtin imaplib/email only."""
import os, re, json, time, email, imaplib, ssl
from email.message import EmailMessage
from email.header import decode_header, make_header
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ENV = os.path.expanduser("~/.config/roadboard/email-accounts.env")
PORT = int(os.environ.get("EMAIL_HELPER_PORT", "8789"))
PREFIX = {"aruba": "ARUBA_IMAP_"}

def load_env(p):
    out = {}
    try:
        for line in open(p, encoding="utf-8").read().splitlines():
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1); out[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return out

def dec(s):
    try:
        return str(make_header(decode_header(s or "")))
    except Exception:
        return s or ""

def snippet_of(msg, n=180):
    try:
        parts = msg.walk() if msg.is_multipart() else [msg]
        for part in parts:
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")):
                payload = part.get_payload(decode=True) or b""
                return payload.decode(part.get_content_charset() or "utf-8", "replace").strip().replace("\r", " ").replace("\n", " ")[:n]
    except Exception:
        pass
    return ""

def connect(env, account):
    pre = PREFIX.get(account)
    if not pre:
        raise ValueError(f"account sconosciuto: {account}")
    host = env.get(pre + "HOST"); port = int(env.get(pre + "PORT", "993"))
    user = env.get(pre + "USER"); pwd = env.get(pre + "PASSWORD")
    if not (host and user and pwd):
        raise ValueError(f"credenziali mancanti per {account}")
    M = imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context())
    M.login(user, pwd)
    return M

def fetch_inbox(env, account, limit):
    M = connect(env, account)
    try:
        M.select("INBOX", readonly=True)
        uids = (M.uid("search", None, "ALL")[1][0] or b"").split()
        unseen = set((M.uid("search", None, "UNSEEN")[1][0] or b"").split())
        out = []
        for u in reversed(uids[-limit:]):
            typ, md = M.uid("fetch", u, "(BODY.PEEK[])")
            if not md or not md[0]:
                continue
            msg = email.message_from_bytes(md[0][1])
            out.append({"uid": int(u), "message_id": (msg.get("Message-ID") or "").strip(),
                        "from": dec(msg.get("From")), "subject": dec(msg.get("Subject")),
                        "date": msg.get("Date") or "", "unread": u in unseen, "snippet": snippet_of(msg)})
        return out
    finally:
        try: M.logout()
        except Exception: pass

def _list_mailbox_name(line):
    """Extract the mailbox name (last element) from an IMAP LIST response line."""
    m = re.search(r'"([^"]*)"\s*$', line)        # quoted trailing name
    if m:
        return m.group(1)
    return line.split()[-1]                        # unquoted final token

def drafts_folder(M):
    """Find the Drafts mailbox: prefer the \\Drafts special-use flag, else common names."""
    try:
        typ, data = M.list()
        if typ == "OK":
            for raw in data:
                line = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
                if "\\Drafts" in line:
                    return _list_mailbox_name(line)
    except Exception:
        pass
    for name in ("Drafts", "INBOX.Drafts", "Bozze", "INBOX.Bozze", "[Gmail]/Drafts"):
        try:
            if M.select(name, readonly=True)[0] == "OK":
                return name
        except Exception:
            pass
    return "Drafts"

def save_draft(env, account, to, subject, body, cc=None, in_reply_to=None):
    pre = PREFIX.get(account)
    from_addr = env.get(pre + "USER") if pre else None
    msg = EmailMessage()
    msg["From"] = from_addr or ""
    msg["To"] = to or ""
    if cc:
        msg["Cc"] = cc
    msg["Subject"] = subject or ""
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(body or "")
    M = connect(env, account)
    try:
        folder = drafts_folder(M)
        typ, resp = M.append('"%s"' % folder, "(\\Draft)", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
        if typ != "OK":
            raise RuntimeError(f"APPEND failed: {resp}")
        return {"folder": folder, "to": to, "subject": subject}
    finally:
        try: M.logout()
        except Exception: pass

def mark_read(env, account, uids):
    clean = [str(int(u)) for u in uids]
    if not clean:
        return 0
    M = connect(env, account)
    try:
        M.select("INBOX")  # read-write
        n = 0
        for u in clean:
            typ, _ = M.uid("STORE", u, "+FLAGS", "(\\Seen)")
            if typ == "OK":
                n += 1
        return n
    finally:
        try: M.logout()
        except Exception: pass

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def _auth(self, env):
        token = env.get("EMAIL_HELPER_TOKEN", "")
        return not token or self.headers.get("Authorization") == f"Bearer {token}"
    def _json(self, code, obj):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())
    def do_GET(self):
        env = load_env(ENV)
        if not self._auth(env):
            return self._json(401, {"error": "unauthorized"})
        u = urlparse(self.path)
        if u.path != "/inbox":
            return self._json(404, {"error": "not found"})
        q = parse_qs(u.query)
        account = q.get("account", ["aruba"])[0]
        limit = max(1, min(30, int(q.get("limit", ["10"])[0])))
        try:
            msgs = fetch_inbox(env, account, limit)
            self._json(200, {"account": account, "count": len(msgs), "messages": msgs})
        except Exception as e:
            self._json(502, {"error": str(e)[:200]})
    def do_POST(self):
        env = load_env(ENV)
        if not self._auth(env):
            return self._json(401, {"error": "unauthorized"})
        path = urlparse(self.path).path
        if path not in ("/mark_read", "/draft"):
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            account = body.get("account", "aruba")
            if path == "/mark_read":
                marked = mark_read(env, account, body.get("uids", []))
                return self._json(200, {"account": account, "marked": marked})
            # /draft
            if not body.get("to"):
                return self._json(400, {"error": "'to' is required"})
            res = save_draft(env, account, body.get("to"), body.get("subject", ""), body.get("body", ""),
                             cc=body.get("cc"), in_reply_to=body.get("in_reply_to"))
            self._json(200, {"account": account, "saved": True, **res})
        except Exception as e:
            self._json(502, {"error": str(e)[:200]})

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
