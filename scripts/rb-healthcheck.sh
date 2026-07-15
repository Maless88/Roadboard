#!/usr/bin/env bash
# rb-healthcheck.sh — deterministic auto-heal for the RoadBoard docker stack (pcm).
# No LLM in the loop. Detects broken roadboard-* containers and force-recreates them,
# then probes core-api. Alerts Maless via the telegram bridge outbound (:8788/send).
#
# States treated as broken:
#   1) restart policy unless-stopped/always AND not running   (crashed/stopped, e.g. Exited 137)
#   2) running AND health == unhealthy
#   3) running AND 0 docker networks attached                 (the subtle bug: lost network -> P1001/EAI_AGAIN)
# One-shot init containers (restart policy "no", e.g. db-bootstrap) are ignored.
#
# Usage: rb-healthcheck.sh [--dry-run]
set -uo pipefail

COMPOSE_DIR="$HOME/work/rb/infra/docker"
PROJECT="roadboard"
ENV_FILE="$HOME/.config/roadboard/telegram-bot.env"
LOG_DIR="$HOME/work/rb/logs"
LOG="$LOG_DIR/rb-healthcheck.log"
LOCK="/tmp/rb-healthcheck.lock"


DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

mkdir -p "$LOG_DIR"
log(){ echo "$(date '+%F %T') $*" >>"$LOG"; }

# single instance
exec 9>"$LOCK"
if ! flock -n 9; then log "another run in progress, skip"; exit 0; fi

envval(){ grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

# Personal/infra values live in ENV_FILE (ALERT_CHAT, PROBE_URL) — never hardcoded here.
ALERT_CHAT="$(envval ALERT_CHAT)"
PROBE_URL="$(envval PROBE_URL)"
[ -z "$PROBE_URL" ] && PROBE_URL="http://127.0.0.1:3001/agents/rooms/direct"

notify(){
  local msg="$1" tok
  tok=$(envval NOTIFY_TOKEN)
  [ -z "$tok" ] && { log "notify skipped (no NOTIFY_TOKEN)"; return; }
  local payload
  payload=$(ALERT_CHAT="$ALERT_CHAT" MSG="$msg" python3 -c 'import json,os; print(json.dumps({"chatId":os.environ["ALERT_CHAT"],"text":os.environ["MSG"]}))')
  curl -s --max-time 8 -X POST http://localhost:8788/send \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1 || log "notify POST failed"
}

cd "$COMPOSE_DIR" || { log "compose dir missing: $COMPOSE_DIR"; exit 1; }

mapfile -t SERVICES < <(docker compose config --services 2>/dev/null | sort)
[ "${#SERVICES[@]}" -eq 0 ] && { log "no compose services found"; exit 1; }

healed=()
failed=()

for svc in "${SERVICES[@]}"; do
  cname="${PROJECT}-${svc}-1"
  info=$(docker inspect "$cname" \
    --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.HostConfig.RestartPolicy.Name}}|{{len .NetworkSettings.Networks}}' 2>/dev/null)
  [ -z "$info" ] && { log "SKIP $cname (no such container)"; continue; }

  IFS='|' read -r status health policy nets <<<"$info"

  reason=""
  case "$policy" in
    unless-stopped|always)
      [ "$status" != "running" ] && reason="down(status=$status)"
      ;;
  esac
  if [ -z "$reason" ] && [ "$status" = "running" ]; then
    [ "$health" = "unhealthy" ] && reason="unhealthy"
    [ "$nets" = "0" ] && reason="no-network"
  fi

  [ -z "$reason" ] && continue

  log "BROKEN $cname -> $reason (status=$status health=$health policy=$policy nets=$nets)"
  if [ "$DRY" -eq 1 ]; then
    healed+=("$svc:$reason [dry-run]")
    continue
  fi
  if docker compose up -d --force-recreate "$svc" >>"$LOG" 2>&1; then
    log "RECREATED $svc"
    healed+=("$svc ($reason)")
  else
    log "RECREATE FAILED $svc"
    failed+=("$svc ($reason)")
  fi
done

# probe core-api after any healing
probe_http=""
if [ "$DRY" -eq 0 ]; then
  sleep 8
  tok=$(envval RB_API_TOKEN)
  probe_http=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 -X POST "$PROBE_URL" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $tok" \
    -d '{"agentSlug":"assistant"}' 2>/dev/null)
  log "PROBE core-api -> HTTP $probe_http"
fi

# alert only when something happened or is still wrong
probe_bad=0
[ -n "$probe_http" ] && [[ ! "$probe_http" =~ ^2[0-9][0-9]$ ]] && probe_bad=1
if [ "${#healed[@]}" -gt 0 ] || [ "${#failed[@]}" -gt 0 ] || [ "$probe_bad" -eq 1 ]; then
  if [ "$DRY" -eq 1 ]; then
    log "DRY-RUN summary: would heal -> ${healed[*]:-none}"
    exit 0
  fi
  msg="🩺 RoadBoard healthcheck"
  [ "${#healed[@]}" -gt 0 ] && msg="$msg
✅ Ripristinati: ${healed[*]}"
  [ "${#failed[@]}" -gt 0 ] && msg="$msg
❌ Falliti: ${failed[*]}"
  [ "$probe_bad" -eq 1 ] && msg="$msg
⚠️ core-api probe: HTTP ${probe_http:-n/a}"
  [ "$probe_bad" -eq 0 ] && [ -n "$probe_http" ] && [ "${#healed[@]}" -gt 0 ] && msg="$msg
core-api ora risponde (HTTP $probe_http)."
  notify "$msg"
  log "ALERT sent"
fi

exit 0
