#!/usr/bin/env bash
# rb-salvo-digest.sh — daily RoadBoard health snapshot authored by agent "Salvo".
#
# Low-noise design:
#  - ALWAYS append a compact entry to a recallable history file (rb-health-history.md).
#  - Call Salvo (LLM) + push to Maless via Vera (:8788/send) ONLY when there is a problem
#    in the last 24h (incident in healthcheck log, container down/unhealthy, disk >=90%).
#  - On a clean day: silent (no Telegram, no LLM call), just the history line.
# History is recallable by asking Salvo ("dammi lo storico salute", he reads the file)
# or by a future agent-settings view.
# Runs once/day via rb-salvo-digest.timer.
set -uo pipefail

BRIDGE_ENV="$HOME/.config/agent-cli-bridge.env"
TG_ENV="$HOME/.config/roadboard/telegram-bot.env"
SALVO_CWD="$HOME/agent-workspaces/salvo"
HC_LOG="$HOME/work/rb/logs/rb-healthcheck.log"
HISTORY="$HOME/work/rb/logs/rb-health-history.md"
LOG="$HOME/work/rb/logs/rb-salvo-digest.log"
# Personal chat id lives in TG_ENV (ALERT_CHAT) — never hardcoded here.

mkdir -p "$(dirname "$LOG")"
log(){ echo "$(date '+%F %T') $*" >>"$LOG"; }
envval(){ grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

BRIDGE_TOKEN=$(envval AGENT_CLI_BRIDGE_TOKEN "$BRIDGE_ENV")
NOTIFY_TOKEN=$(envval NOTIFY_TOKEN "$TG_ENV")
ALERT_CHAT=$(envval ALERT_CHAT "$TG_ENV")

TODAY=$(date '+%Y-%m-%d'); YDAY=$(date -d 'yesterday' '+%Y-%m-%d' 2>/dev/null || echo "$TODAY")

# --- deterministic fact gathering ---
HC_TAIL=$(tail -n 400 "$HC_LOG" 2>/dev/null | grep -E "$TODAY|$YDAY" || true)
INCIDENTS=$(printf '%s\n' "$HC_TAIL" | grep -cE 'RECREATED|RECREATE FAILED|BROKEN' || true)
DOCKER_STATE=$(docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null | grep roadboard || echo "(docker ps non disponibile)")
# containers that should be up but aren't (exclude one-shot db-bootstrap and its clean Exited(0))
DOWN=$(printf '%s\n' "$DOCKER_STATE" | grep -viE 'db-bootstrap' | grep -viE $'\tUp ' | grep -viE 'Up$' || true)
UNHEALTHY=$(printf '%s\n' "$DOCKER_STATE" | grep -i 'unhealthy' || true)
DISK=$(df / | awk 'NR==2{gsub("%","",$5); print $5}')
HOST=$(printf 'uptime: %s\n%s\n%s' "$(uptime | sed 's/^ *//')" "$(free -h | grep -E 'Mem|Swap')" "$(df -h / | tail -1)")

PROBLEM=0
[ "${INCIDENTS:-0}" -gt 0 ] && PROBLEM=1
[ -n "$DOWN" ] && PROBLEM=1
[ -n "$UNHEALTHY" ] && PROBLEM=1
[ "${DISK:-0}" -ge 90 ] && PROBLEM=1

# --- always append a compact history entry ---
{
  echo "## $(date '+%F %T')  —  $([ "$PROBLEM" -eq 0 ] && echo 'OK' || echo 'PROBLEMA')"
  echo "- incidenti 24h: ${INCIDENTS:-0} | disco /: ${DISK}% | $(uptime | sed 's/^.*load/load/')"
  [ -n "$DOWN" ] && echo "- container non-up: $(printf '%s' "$DOWN" | tr '\n' ';')"
  [ -n "$UNHEALTHY" ] && echo "- unhealthy: $(printf '%s' "$UNHEALTHY" | tr '\n' ';')"
  echo
} >>"$HISTORY"
log "history appended (problem=$PROBLEM incidents=${INCIDENTS:-0} disk=${DISK}%)"

# --- clean day: stop here, no LLM, no Telegram ---
if [ "$PROBLEM" -eq 0 ]; then
  log "clean day, no digest sent"
  exit 0
fi

# --- problem: ask Salvo for a narrative, then push to Maless ---
[ -z "$BRIDGE_TOKEN" ] && { log "no AGENT_CLI_BRIDGE_TOKEN"; exit 1; }
PROMPT="Sei Salvo, il dottore ops di RoadBoard. Nelle ultime 24h c'e' stato ALMENO un problema sullo stack (pcm). Ti passo i dati grezzi gia' raccolti (NON eseguire tool). Produci un alert CONCISO in italiano:
- Cosa e' successo (container down/unhealthy, incidenti dall'healthcheck, disco/host oltre soglia).
- Se e' stato auto-riparato o e' ancora aperto.
- Se emerge un pattern ricorrente o un problema strutturale, una raccomandazione secca. Niente preamboli.

=== docker ps -a (roadboard) ===
$DOCKER_STATE

=== rb-healthcheck.log (ultime 24h) ===
${HC_TAIL:-(nessuna riga)}

=== metriche host ===
$HOST"

PAYLOAD=$(PROMPT="$PROMPT" CWD="$SALVO_CWD" python3 -c 'import json,os; print(json.dumps({"prompt":os.environ["PROMPT"],"cwd":os.environ["CWD"],"provider":"claude-code"}))')
log "problem detected, invoking salvo"
DIGEST=$(curl -s --max-time 180 -X POST http://localhost:8787/run \
  -H "Authorization: Bearer $BRIDGE_TOKEN" -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null)
DIGEST=$(printf '%s' "$DIGEST" | sed 's/[[:space:]]*$//')
[ -z "$DIGEST" ] && { log "empty digest from salvo"; exit 1; }
log "digest: $(printf '%s' "$DIGEST" | tr '\n' ' ' | cut -c1-200)"

if [ -n "$NOTIFY_TOKEN" ]; then
  MSG="⚠️ Alert salute RoadBoard (Salvo)
$DIGEST"
  OUT=$(ALERT_CHAT="$ALERT_CHAT" MSG="$MSG" python3 -c 'import json,os; print(json.dumps({"chatId":os.environ["ALERT_CHAT"],"text":os.environ["MSG"]}))')
  curl -s --max-time 8 -X POST http://localhost:8788/send \
    -H "Authorization: Bearer $NOTIFY_TOKEN" -H "Content-Type: application/json" \
    -d "$OUT" >/dev/null 2>&1 || log "notify POST failed"
  log "alert sent"
else
  log "no NOTIFY_TOKEN, alert not sent"
fi
exit 0
