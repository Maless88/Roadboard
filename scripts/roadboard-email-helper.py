#!/usr/bin/env python3
"""RoadBoard email helper (host). Read-only IMAP inbox peek for Cleo (secretary).
GET /inbox?account=aruba&limit=N  (Bearer EMAIL_HELPER_TOKEN) -> JSON [{from,subject,date,unread,snippet}].
Creds from ~/.config/roadboard/email-accounts.env. Uses BODY.PEEK so messages stay unread.
Builtin imaplib/email only — no deps."""
import os, json, email, imaplib, ssl
from email.header import decode_header, make_header
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ENV = os.path.expanduser("~/.config/roadboard/email-accounts.env")
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

PORT = int(os.environ.get("EMAIL_HELPER_PORT", "8789"))

def dec(s):
    try:
        return str(make_header(decode_header(s or "")))
    except Exception:
        return s or ""

def snippet_of(msg, n=180):
    try:
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")):
                    payload = part.get_payload(decode=True) or b""
                    return payload.decode(part.get_content_charset() or "utf-8", "replace").strip().replace("\r", " ").replace("\n", " ")[:n]
            return ""
        payload = msg.get_payload(decode=True) or b""
        return payload.decode(msg.get_content_charset() or "utf-8", "replace").strip().replace("\r", " ").replace("\n", " ")[:n]
    except Exception:
        return ""

def fetch_inbox(env, account, limit):
    pre = {"aruba": "ARUBA_IMAP_"}.get(account)
    if not pre:
        raise ValueError(f"account sconosciuto: {account}")
    host = env.get(pre + "HOST"); port = int(env.get(pre + "PORT", "993"))
    user = env.get(pre + "USER"); pwd = env.get(pre + "PASSWORD")
    if not (host and user and pwd):
        raise ValueError(f"credenziali mancanti per {account}")
    M = imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context())
    try:
        M.login(user, pwd)
        M.select("INBOX", readonly=True)
        typ, data = M.search(None, "ALL")
        ids = data[0].split()
        unseen = set((M.search(None, "UNSEEN")[1][0] or b"").split())
        out = []
        for mid in reversed(ids[-limit:]):
            typ, md = M.fetch(mid, "(BODY.PEEK[])")
            if not md or not md[0]:
                continue
            msg = email.message_from_bytes(md[0][1])
            out.append({
                "from": dec(msg.get("From")),
                "subject": dec(msg.get("Subject")),
                "date": msg.get("Date") or "",
                "unread": mid in unseen,
                "snippet": snippet_of(msg),
            })
        return out
    finally:
        try: M.logout()
        except Exception: pass

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        env = load_env(ENV)
        token = env.get("EMAIL_HELPER_TOKEN", "")
        if token and self.headers.get("Authorization") != f"Bearer {token}":
            self.send_response(401); self.end_headers(); self.wfile.write(b"unauthorized"); return
        u = urlparse(self.path)
        if u.path != "/inbox":
            self.send_response(404); self.end_headers(); self.wfile.write(b"not found"); return
        q = parse_qs(u.query)
        account = (q.get("account", ["aruba"])[0])
        limit = max(1, min(30, int(q.get("limit", ["10"])[0])))
        try:
            msgs = fetch_inbox(env, account, limit)
            body = json.dumps({"account": account, "count": len(msgs), "messages": msgs}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
        except Exception as e:
            self.send_response(502); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)[:200]}).encode())

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
