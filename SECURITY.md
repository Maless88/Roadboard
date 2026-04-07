# Security Policy

## Supported versions

Only the latest commit on the `main` branch is actively maintained.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Instead, send a private report via GitHub's [Security Advisories](https://github.com/Maless88/rb/security/advisories/new) feature.

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
