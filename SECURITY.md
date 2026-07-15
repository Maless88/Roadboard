# Security Policy

## Supported versions

Only the latest commit on the `main` branch is actively maintained.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Instead, send a private report via GitHub's [Security Advisories](https://github.com/Maless88/Roadboard/security/advisories/new) feature.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive an acknowledgement within 72 hours. We aim to release a fix within 14 days for confirmed critical issues.

## Scope

In scope:
- Authentication and session management (`apps/auth-access`)
- MCP token issuance and validation
- SQL injection or data exposure via REST API
- Privilege escalation via grants system

Out of scope:
- Issues in development-only seed data or scripts
- Vulnerabilities in third-party dependencies not yet patched upstream

## Deployment hardening checklist

Self-hosted deployments should set these before exposing any service:

- `JWT_SECRET` / `SESSION_SECRET` — required real values (`openssl rand -hex 32`).
  The dev compose defaults to `change-me-in-production`; credential
  encryption refuses to run with the placeholder.
- `CRED_ENC_KEY` — dedicated key for at-rest encryption of per-user provider
  credentials (falls back to `JWT_SECRET` when unset).
- `SESSION_COOKIE_SECURE=true` — when the web-app is served behind HTTPS.
- `BIND_ADDR` / `WEB_BIND_ADDR` — bind services to `127.0.0.1` or a private
  network interface unless intentionally public. Postgres/Redis/Memgraph are
  already bound to `127.0.0.1` in the provided compose file.
- The dev compose ships default Postgres credentials (`roadboard`/`roadboard`)
  bound to localhost — change them for any non-local deployment.

## Known limitations

- Team invite tokens are stored in plaintext (unlike sessions and MCP tokens,
  which are SHA-256 hashed at rest) so that pending invite links can be
  re-copied from the team page. Invite tokens are 256-bit random,
  single-purpose, and expire; the residual risk is limited to a database
  compromise scenario. Hashing them requires a show-once invite-link flow.
