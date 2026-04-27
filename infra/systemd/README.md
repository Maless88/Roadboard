# Self-hosted deploy + drift check — systemd units

One-time install on a host running the Roadboard compose stack:

```bash
# Deploy trigger (CF-GDB / release UX)
sudo install -m 0644 roadboard-deploy.service /etc/systemd/system/
sudo install -m 0644 roadboard-deploy.path /etc/systemd/system/
sudo chmod +x /opt/roadboard/scripts/deploy.sh

# CodeFlow drift check (CF-GDB-03c-4)
sudo install -m 0644 roadboard-drift-check.service /etc/systemd/system/
sudo install -m 0644 roadboard-drift-check.timer /etc/systemd/system/
sudo chmod +x /opt/roadboard/scripts/drift-check.sh

# Add DRIFT_CHECK_TOKEN=<mcp-token-with-codeflow.read> to
# /opt/roadboard/infra/docker/.env (read by EnvironmentFile= in the
# .service unit). Example:
#   DRIFT_CHECK_TOKEN=mcp_xxx
# Optional override:
#   DRIFT_CHECK_PROJECT_ID=<project-id-to-check> (defaults to Roadboard 2.0)

sudo systemctl daemon-reload
sudo systemctl enable --now roadboard-deploy.path
sudo systemctl enable --now roadboard-drift-check.timer
```

## How it works

- `core-api` (inside its container) writes `/opt/roadboard/.deploy-requested`
  when an admin clicks "Deploy" in the banner.
- `roadboard-deploy.path` watches that file via `PathExists`. Systemd
  triggers `roadboard-deploy.service` within milliseconds.
- The service runs `/opt/roadboard/scripts/deploy.sh` on the host (not
  inside a container), so it survives the core-api container replacement
  during the `docker compose up -d --build`.
- `ExecStopPost=rm -f .deploy-requested` always clears the trigger so a
  failed retry click re-arms the path unit.

## Observability

```
systemctl status roadboard-deploy.service      # current state
journalctl -u roadboard-deploy.service -f      # live log
journalctl -u roadboard-deploy.service --since '1 hour ago'
```

## Why not cron / not inside core-api

- Polling cron would introduce up to 10-30s latency per click.
- Running the compose command from inside core-api would be killed by
  `docker kill` the moment the compose recreates the core-api container
  itself (SIGKILL → exit 137, orphan containers in `Created` state).
