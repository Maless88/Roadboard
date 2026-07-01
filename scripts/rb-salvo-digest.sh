#!/usr/bin/env bash
# rb-salvo-digest.sh — daily health digest for the RoadBoard stack, authored by agent "Salvo".
# Deterministic part gathers the facts (healthcheck log + docker state + host metrics);
# Salvo (LLM) only reasons over them and writes the digest. Result is pushed to Maless via
# the telegram bridge outbound (:8788/send). Runs once/day via rb-salvo-digest.timer.
set -uo pipefail

BRIDGE_ENV="$HOME/.config/agent-cli-bridge.env"
TG_ENV="$HOME/.config/roadboard/telegram-bot.env"
SALVO_CWD="$HOME/agent-workspaces/salvo"
HC_LOG="$HOME/work/rb/logs/rb-healthcheck.log"
LOG="$HOME/work/rb/logs/rb-salvo-digest.log"
ALERT_CHAT="218660141"

mkdir -p "$(dirname "$LOG")"
log(){ echo "$(date '+%F %T') $*" >>"$LOG"; }

envval(){ grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

BRIDGE_TOKEN=$(envval AGENT_CLI_BRIDGE_TOKEN "$BRIDGE_ENV")
NOTIFY_TOKEN=$(envval NOTIFY_TOKEN "$TG_ENV")
[ -z "$BRIDGE_TOKEN" ] && { log "no AGENT_CLI_BRIDGE_TOKEN"; exit 1; }

# --- deterministic fact gathering ---
HC_TAIL=$(tail -n 400 "$HC_LOG" 2>/dev/null | grep -E "$(date '+%Y-%m-%d')|$(date -d 'yesterday' '+%Y-%m-%d' 2>/dev/null)" || echo "(nessuna riga nelle ultime 24h)")
DOCKER_STATE=$(docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null | grep roadboard || echo "(docker ps non disponibile)")
HOST=$(printf 'uptime: %s\n%s\n%s' "$(uptime | sed 's/^ *//')" "$(free -h | grep -E 'Mem|Swap')" "$(df -h / | tail -1)")

PROMPT="Sei Salvo, il dottore ops di RoadBoard. Digest giornaliero della salute dello stack sul pcm. Ti passo i dati grezzi gia' raccolti (NON hai bisogno di eseguire tool). Produci un digest CONCISO in italiano:
- Stato attuale dei container (tutti up? qualcuno down/unhealthy?).
- Incidenti nelle ultime 24h dal log dell'healthcheck: quante volte e' stato ricreato qualcosa, quali servizi, se ci sono pattern ricorrenti.
- SOLO se emerge un problema strutturale (stesso servizio che cade ripetutamente, probe core-api fallito, ecc.), una raccomandazione secca.
Se tutto e' sano e non ci sono stati incidenti, dillo in UNA riga. Niente preamboli.

=== docker ps -a (roadboard) ===
$DOCKER_STATE

=== rb-healthcheck.log (ultime 24h) ===
$HC_TAIL

=== metriche host ===
$HOST"

PAYLOAD=$(PROMPT="$PROMPT" CWD="$SALVO_CWD" python3 -c 'import json,os; print(json.dumps({"prompt":os.environ["PROMPT"],"cwd":os.environ["CWD"],"provider":"claude-code"}))')

log "invoking salvo via bridge"
DIGEST=$(curl -s --max-time 180 -X POST http://localhost:8787/run \
  -H "Authorization: Bearer $BRIDGE_TOKEN" -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null)

DIGEST=$(printf '%s' "$DIGEST" | sed 's/[[:space:]]*$//')
[ -z "$DIGEST" ] && { log "empty digest from salvo"; exit 1; }
log "digest: $(printf '%s' "$DIGEST" | tr '\n' ' ' | cut -c1-200)"

# --- push to Maless ---
if [ -n "$NOTIFY_TOKEN" ]; then
  MSG="🩺 Digest RoadBoard (Salvo)
$DIGEST"
  OUT=$(ALERT_CHAT="$ALERT_CHAT" MSG="$MSG" python3 -c 'import json,os; print(json.dumps({"chatId":os.environ["ALERT_CHAT"],"text":os.environ["MSG"]}))')
  curl -s --max-time 8 -X POST http://localhost:8788/send \
    -H "Authorization: Bearer $NOTIFY_TOKEN" -H "Content-Type: application/json" \
    -d "$OUT" >/dev/null 2>&1 || log "notify POST failed"
  log "digest sent"
else
  log "no NOTIFY_TOKEN, digest not sent"
fi
exit 0
