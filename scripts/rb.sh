#!/usr/bin/env bash
# RoadBoard service manager.
# Must be run from the monorepo root or any subdirectory.
#
# Usage:
#   ./scripts/rb.sh up              # start everything
#   ./scripts/rb.sh up core-api     # start a single service (+ its deps)
#   ./scripts/rb.sh down            # stop everything
#   ./scripts/rb.sh down core-api   # stop a single service
#   ./scripts/rb.sh restart         # restart everything
#   ./scripts/rb.sh restart web-app # restart a single service
#   ./scripts/rb.sh build           # (re)build all images
#   ./scripts/rb.sh build core-api  # (re)build a single image
#   ./scripts/rb.sh logs            # follow logs for all services
#   ./scripts/rb.sh logs core-api   # follow logs for a single service
#   ./scripts/rb.sh ps              # show running containers
#   ./scripts/rb.sh status          # alias for ps

set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/infra/docker/docker-compose.yml"
DC="docker compose -f ${COMPOSE_FILE}"

SERVICES=(postgres redis migrate core-api auth-access worker-jobs local-sync-bridge web-app)

usage() {
  grep '^#' "$0" | grep -v '#!/' | sed 's/^# //'
  exit 1
}

valid_service() {
  local svc="$1"

  for s in "${SERVICES[@]}"; do

    if [[ "$s" == "$svc" ]]; then
      return 0
    fi
  done

  echo "Unknown service: $svc"
  echo "Valid services: ${SERVICES[*]}"
  exit 1
}

cmd="${1:-}"
svc="${2:-}"

[[ -z "$cmd" ]] && usage

if [[ -n "$svc" ]]; then
  valid_service "$svc"
fi

case "$cmd" in

  up)
    if [[ -n "$svc" ]]; then
      echo "Starting $svc (and its dependencies)..."
      $DC up -d --build "$svc"
    else
      echo "Starting all services..."
      $DC up -d --build
    fi
    ;;

  down)
    if [[ -n "$svc" ]]; then
      echo "Stopping $svc..."
      $DC stop "$svc"
      $DC rm -f "$svc"
    else
      echo "Stopping all services..."
      $DC down
    fi
    ;;

  restart)
    if [[ -n "$svc" ]]; then
      echo "Restarting $svc..."
      $DC restart "$svc"
    else
      echo "Restarting all services..."
      $DC restart
    fi
    ;;

  build)
    if [[ -n "$svc" ]]; then
      echo "Building $svc..."
      $DC build "$svc"
    else
      echo "Building all images..."
      $DC build
    fi
    ;;

  logs)
    if [[ -n "$svc" ]]; then
      $DC logs -f "$svc"
    else
      $DC logs -f
    fi
    ;;

  ps|status)
    $DC ps
    ;;

  *)
    echo "Unknown command: $cmd"
    usage
    ;;

esac
