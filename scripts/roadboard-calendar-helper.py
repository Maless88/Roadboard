#!/usr/bin/env python3
"""RoadBoard calendar helper (host). Nextcloud CalDAV — read upcoming events + create events.
GET  /events?days=N&calendar=NAME           -> JSON [{start,end,summary,location,calendar}]
POST /event {summary,start,end?,description?,location?,calendar?} -> create VEVENT (PUT)
Bearer CALENDAR_HELPER_TOKEN. Creds from ~/.config/roadboard/calendar.env. Stdlib only (urllib + zoneinfo)."""
import os, json, base64, uuid, datetime as dt
import urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ENV = os.path.expanduser("~/.config/roadboard/calendar.env")
PORT = int(os.environ.get("CALENDAR_HELPER_PORT", "8790"))
TZ = ZoneInfo(os.environ.get("CALENDAR_TZ", "Europe/Rome"))
NS = {"d": "DAV:", "cal": "urn:ietf:params:xml:ns:caldav", "cs": "http://calendarserver.org/ns/"}


def load_env(p):
    out = {}
    try:
        for line in open(p, encoding="utf-8").read().splitlines():
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1); out[k.strip()] = v.strip().strip("\"'")
    except FileNotFoundError:
        pass
    return out


def cfg(env):
    c = {
        "url": env.get("NEXTCLOUD_URL", "https://cloud.xstream-labs.com"),
        "user": env.get("NEXTCLOUD_USER"),
        "password": env.get("NEXTCLOUD_APP_PASSWORD"),
        "default_calendar": env.get("CALENDAR_DEFAULT", ""),
    }
    if not (c["user"] and c["password"]):
        raise ValueError("credenziali CalDAV mancanti")
    return c


def request(method, url, user, password, body=None, headers=None):
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    data = body.encode("utf-8") if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("User-Agent", "roadboard-calendar/0.1")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.status, res.read()


def propfind(url, u, p, body, depth="0"):
    return request("PROPFIND", url, u, p, body=body, headers={"Depth": depth, "Content-Type": "application/xml; charset=utf-8"})[1]


def report(url, u, p, body):
    return request("REPORT", url, u, p, body=body, headers={"Depth": "1", "Content-Type": "application/xml; charset=utf-8"})[1]


def _t(node):
    return node.text if node is not None else None


def calendar_home(c):
    base = c["url"].rstrip("/")
    principal = f"{base}/remote.php/dav/principals/users/{urllib.parse.quote(c['user'])}/"
    body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"><d:prop><cal:calendar-home-set/></d:prop></d:propfind>'
    root = ET.fromstring(propfind(principal, c["user"], c["password"], body))
    href = root.find(".//cal:calendar-home-set/d:href", NS)
    if href is None or not href.text:
        raise RuntimeError("calendar-home-set non trovato")
    return urllib.parse.urljoin(base + "/", href.text)


def list_calendars(c):
    home = calendar_home(c)
    body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>'
    root = ET.fromstring(propfind(home, c["user"], c["password"], body, depth="1"))
    cals = []
    for resp in root.findall("d:response", NS):
        href = _t(resp.find("d:href", NS))
        disp = _t(resp.find(".//d:displayname", NS)) or href
        is_cal = resp.find(".//d:resourcetype/cal:calendar", NS) is not None
        if href and is_cal:
            cals.append((disp, urllib.parse.urljoin(c["url"], href)))
    return cals


def parse_ics_dt(value):
    value = value.strip()
    if not value:
        return None
    if len(value) == 8 and value.isdigit():
        return dt.datetime.strptime(value, "%Y%m%d").replace(tzinfo=dt.timezone.utc)
    if value.endswith("Z"):
        return dt.datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc)
    for fmt in ("%Y%m%dT%H%M%S", "%Y%m%dT%H%M"):
        try:
            return dt.datetime.strptime(value, fmt).replace(tzinfo=TZ)
        except ValueError:
            pass
    return None


def unfold(ics):
    out = []
    for raw in ics.replace("\r\n", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and out:
            out[-1] += raw[1:]
        else:
            out.append(raw)
    return out


def parse_events(ics):
    evs, cur = [], None
    for line in unfold(ics):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT" and cur is not None:
            evs.append(cur); cur = None
        elif cur is not None and ":" in line:
            left, val = line.split(":", 1)
            name = left.split(";", 1)[0].upper()
            if name in {"SUMMARY", "DTSTART", "DTEND", "LOCATION", "UID"}:
                cur[name] = val.replace("\\,", ",").replace("\\n", " ")
    return evs


def upcoming(c, days, calendar_name=None):
    cals = list_calendars(c)
    if calendar_name:
        cals = [x for x in cals if x[0].lower() == calendar_name.lower()] or cals
    now = dt.datetime.now(dt.timezone.utc)
    end = now + dt.timedelta(days=days)
    body = (f'<?xml version="1.0"?><cal:calendar-query xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">'
            f'<d:prop><cal:calendar-data/></d:prop><cal:filter><cal:comp-filter name="VCALENDAR">'
            f'<cal:comp-filter name="VEVENT"><cal:time-range start="{now.strftime("%Y%m%dT%H%M%SZ")}" end="{end.strftime("%Y%m%dT%H%M%SZ")}"/>'
            f'</cal:comp-filter></cal:comp-filter></cal:filter></cal:calendar-query>')
    found = []
    for name, url in cals:
        try:
            root = ET.fromstring(report(url, c["user"], c["password"], body))
        except Exception:
            continue
        for data in root.findall(".//cal:calendar-data", NS):
            for ev in parse_events(data.text or ""):
                start = parse_ics_dt(ev.get("DTSTART", ""))
                if start:
                    found.append({
                        "start": start.astimezone(TZ).isoformat(),
                        "end": (parse_ics_dt(ev.get("DTEND", "")).astimezone(TZ).isoformat() if parse_ics_dt(ev.get("DTEND", "")) else None),
                        "summary": ev.get("SUMMARY", "(senza titolo)"),
                        "location": ev.get("LOCATION"),
                        "calendar": name,
                    })
    found.sort(key=lambda e: e["start"])
    return found


def resolve_calendar(c, name):
    cals = list_calendars(c)
    if not cals:
        raise RuntimeError("nessun calendario")
    target = name or c.get("default_calendar")
    if target:
        for disp, url in cals:
            if disp.lower() == target.lower():
                return url
    return cals[0][1]  # fallback: primo calendario


def _ics_dt(value, default_hours=0):
    """Return (prop_suffix, value_str, is_allday) for an ISO start/end."""
    value = (value or "").strip()
    if len(value) == 10:  # YYYY-MM-DD -> all-day
        return ";VALUE=DATE", value.replace("-", ""), True
    d = dt.datetime.fromisoformat(value)
    if d.tzinfo is None:
        d = d.replace(tzinfo=TZ)
    return "", d.astimezone(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ"), False


def esc(s):
    return (s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def create_event(c, f):
    summary = (f.get("summary") or "").strip()
    start = (f.get("start") or "").strip()
    if not summary or not start:
        raise ValueError("'summary' e 'start' sono obbligatori")
    cal_url = resolve_calendar(c, f.get("calendar"))
    uid = f"{uuid.uuid4()}@roadboard"
    ds_suf, ds_val, allday = _ics_dt(start)
    if f.get("end"):
        de_suf, de_val, _ = _ics_dt(f["end"])
    elif allday:
        d = dt.datetime.strptime(ds_val, "%Y%m%d") + dt.timedelta(days=1)
        de_suf, de_val = ";VALUE=DATE", d.strftime("%Y%m%d")
    else:
        d = dt.datetime.strptime(ds_val, "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc) + dt.timedelta(hours=1)
        de_suf, de_val = "", d.strftime("%Y%m%dT%H%M%SZ")
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RoadBoard//calendar-helper//IT", "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{now}", f"DTSTART{ds_suf}:{ds_val}", f"DTEND{de_suf}:{de_val}",
        f"SUMMARY:{esc(summary)}",
    ]
    if f.get("description"):
        lines.append(f"DESCRIPTION:{esc(f['description'])}")
    if f.get("location"):
        lines.append(f"LOCATION:{esc(f['location'])}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    ics = "\r\n".join(lines) + "\r\n"
    href = cal_url.rstrip("/") + "/" + uid + ".ics"
    status, _ = request("PUT", href, c["user"], c["password"], body=ics,
                        headers={"Content-Type": "text/calendar; charset=utf-8", "If-None-Match": "*"})
    return {"ok": status in (200, 201, 204), "uid": uid, "href": href, "status": status, "summary": summary, "start": start}


def delete_event(c, href):
    if not href or "/remote.php/dav/" not in href:
        raise ValueError("href non valido")
    status, _ = request("DELETE", href, c["user"], c["password"])
    return {"ok": status in (200, 204, 404), "status": status}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _auth(self, env):
        token = env.get("CALENDAR_HELPER_TOKEN", "")
        return not token or self.headers.get("Authorization") == f"Bearer {token}"

    def _json(self, code, obj):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_GET(self):
        env = load_env(ENV)
        if not self._auth(env):
            return self._json(401, {"error": "unauthorized"})
        u = urlparse(self.path)
        if u.path != "/events":
            return self._json(404, {"error": "not found"})
        q = parse_qs(u.query)
        days = max(1, min(120, int(q.get("days", ["14"])[0])))
        cal = q.get("calendar", [None])[0]
        try:
            self._json(200, {"days": days, "events": upcoming(cfg(env), days, cal)})
        except Exception as e:
            self._json(502, {"error": str(e)[:200]})

    def do_POST(self):
        env = load_env(ENV)
        if not self._auth(env):
            return self._json(401, {"error": "unauthorized"})
        if urlparse(self.path).path != "/event":
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            self._json(200, create_event(cfg(env), body))
        except Exception as e:
            self._json(502, {"error": str(e)[:200]})

    def do_DELETE(self):
        env = load_env(ENV)
        if not self._auth(env):
            return self._json(401, {"error": "unauthorized"})
        if urlparse(self.path).path != "/event":
            return self._json(404, {"error": "not found"})
        href = parse_qs(urlparse(self.path).query).get("href", [None])[0]
        try:
            self._json(200, delete_event(cfg(env), href))
        except Exception as e:
            self._json(502, {"error": str(e)[:200]})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
