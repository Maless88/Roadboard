#!/bin/bash
# Roadboard self-hosted deploy script.
#
# Invoked by roadboard-deploy.service (systemd) when the trigger file
# /opt/roadboard/.deploy-requested is touched by core-api.
#
# Runs on the host, outside any container, so it survives the
# core-api container replacement during the compose up.
set -euo pipefail

REPO_PATH="${ROADBOARD_REPO_PATH:-/opt/roadboard}"
COMPOSE_FILE="${ROADBOARD_COMPOSE_FILE:-infra/docker/docker-compose.yml}"
BRANCH="${ROADBOARD_DEPLOY_BRANCH:-main}"

cd "$REPO_PATH"

echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) starting on branch=$BRANCH"

git -c safe.directory="$REPO_PATH" fetch --all --prune
git -c safe.directory="$REPO_PATH" checkout "$BRANCH"
git -c safe.directory="$REPO_PATH" pull --ff-only origin "$BRANCH"

export GIT_SHA="$(git -c safe.directory="$REPO_PATH" rev-parse HEAD)"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[deploy] target sha=$GIT_SHA"

docker compose -f "$COMPOSE_FILE" up -d --build

echo "[deploy] done"
