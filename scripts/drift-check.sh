#!/bin/bash
# Drift check between Postgres and Memgraph for the CodeFlow / Atlas
# projection (CF-GDB-03c). Invoked hourly by roadboard-drift-check.timer.
#
# Calls GET /codeflow/admin/drift on the local core-api with an MCP token
# (env DRIFT_CHECK_TOKEN, must have scope codeflow.read), then:
#   - exit 0 if totalDrift == 0
#   - exit 1 if totalDrift > 0 → systemd marks the service failed and the
#     drift entries appear in journalctl
#
# A token without codeflow.read returns 403, treated as a config error
# (exit 2).
set -euo pipefail

CORE_API_URL="${CORE_API_URL:-http://localhost:3001}"
PROJECT_ID="${DRIFT_CHECK_PROJECT_ID:-cmnrj9our000eo343kksv2y8o}"
TOKEN="${DRIFT_CHECK_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "[drift-check] DRIFT_CHECK_TOKEN not set; aborting" >&2
  exit 2
fi

URL="${CORE_API_URL}/projects/${PROJECT_ID}/codeflow/graph/drift"
RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

HTTP_CODE=$(curl -sS -o "$RESPONSE_FILE" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" "$URL")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "[drift-check] HTTP $HTTP_CODE — token problem" >&2
  cat "$RESPONSE_FILE" >&2
  exit 2
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "[drift-check] HTTP $HTTP_CODE — upstream error" >&2
  cat "$RESPONSE_FILE" >&2
  exit 2
fi

# Parse with python (already in alpine via dependencies, fallback to grep)
TOTAL_DRIFT=$(python3 -c "import json,sys; d=json.load(open('$RESPONSE_FILE')); print(d.get('totalDrift',0))" 2>/dev/null \
  || grep -oE '"totalDrift":[0-9]+' "$RESPONSE_FILE" | head -1 | cut -d: -f2)

REACHABLE=$(python3 -c "import json,sys; d=json.load(open('$RESPONSE_FILE')); print(str(d.get('reachable',False)).lower())" 2>/dev/null \
  || grep -oE '"reachable":(true|false)' "$RESPONSE_FILE" | head -1 | cut -d: -f2)

if [ "$REACHABLE" != "true" ]; then
  echo "[drift-check] Memgraph unreachable; reporting nothing (skip)"
  exit 0
fi

echo "[drift-check] $(date -u +%Y-%m-%dT%H:%M:%SZ) totalDrift=$TOTAL_DRIFT"

if [ "$TOTAL_DRIFT" = "0" ]; then
  exit 0
fi

# Drift detected. Log the per-entity breakdown and exit 1 so systemd
# surfaces the failure.
echo "[drift-check] DRIFT DETECTED — see report below" >&2
cat "$RESPONSE_FILE" >&2
exit 1
