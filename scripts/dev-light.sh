#!/usr/bin/env bash
# dev-light.sh — start a minimal Roadboard dev stack.
#
# Avvia solo l'essenziale per vedere il frontend con le ultime modifiche:
#   - infra Docker (postgres + memgraph)  — già attivi normalmente
#   - core-api + auth-access via Docker (rebuild su richiesta)
#   - web-app in dev mode sull'host (Next.js) su PORT (default 3010)
#
# Esclude di proposito: worker-jobs, mcp-service, local-sync-bridge.
# Aggiungili solo se ti servono (es. worker-jobs per outbox graph-sync).
#
# Uso:
#   ./scripts/dev-light.sh                  # avvia tutto, port web-app 3010
#   PORT=3030 ./scripts/dev-light.sh        # port web-app custom
#   REBUILD=1 ./scripts/dev-light.sh        # rebuild immagini core-api + auth-access
#   SKIP_INFRA=1 ./scripts/dev-light.sh     # salta docker compose (usa container già up)

set -euo pipefail

# Carica nvm se pnpm non è già in PATH (necessario quando lo script gira da background/cron senza login shell)
if ! command -v pnpm >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
  fi
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $ROOT/infra/docker/docker-compose.yml"
PORT="${PORT:-3010}"
REBUILD="${REBUILD:-0}"
SKIP_INFRA="${SKIP_INFRA:-0}"

cd "$ROOT"

echo "==> Roadboard dev (light) — port web-app: $PORT"

# Health check: load average
LOAD=$(awk '{print $1}' /proc/loadavg)
LOAD_INT=${LOAD%.*}
if [ "$LOAD_INT" -ge 6 ]; then
  echo "⚠  Load average $LOAD alto. Aspetta che scenda sotto 4 o chiudi app pesanti."
  read -p "Continuare comunque? [y/N] " ans
  [ "$ans" = "y" ] || exit 1
fi

# Port collision check
if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  echo "✗ Port $PORT è già occupato. Sceglila diversa con PORT=NNNN ./dev-light.sh"
  exit 1
fi

# Infra
if [ "$SKIP_INFRA" != "1" ]; then
  echo "==> Verifico/avvio infra Docker (postgres + memgraph)"
  $COMPOSE up -d postgres memgraph
  echo "==> Verifico/avvio servizi backend (core-api + auth-access)"
  if [ "$REBUILD" = "1" ]; then
    $COMPOSE build core-api auth-access
    $COMPOSE up -d --no-deps core-api auth-access
  else
    $COMPOSE up -d core-api auth-access
  fi
fi

# Sanity: containers healthy?
sleep 2
for svc in postgres memgraph core-api auth-access; do
  state=$($COMPOSE ps --format '{{.State}}' "$svc" 2>/dev/null | head -1)
  if [ "$state" != "running" ]; then
    echo "✗ Container $svc non running (state=$state). Controlla con: $COMPOSE logs $svc"
    exit 1
  fi
done
echo "✓ Infra OK"

# Smoke test endpoints
if ! curl -fsS http://localhost:3001/health >/dev/null 2>&1; then
  echo "⚠ core-api /health non risponde su :3001 (forse ancora in boot)"
fi
if ! curl -fsS http://localhost:3002/health >/dev/null 2>&1; then
  echo "⚠ auth-access /health non risponde su :3002 (forse ancora in boot)"
fi

# Web-app on host
echo "==> Avvio web-app su :$PORT (Next.js dev, host node)"
echo "    URL: http://localhost:$PORT"
echo "    Ctrl-C per fermare (i container Docker restano up)"
echo

cd apps/web-app
exec pnpm exec next dev -p "$PORT" -H 0.0.0.0
