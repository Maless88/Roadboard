# Roadboard 2.0 Auth & Access Structure

## Goal
Define the internal structure of the `auth-access` service.

This service owns the identity and access domain for Roadboard 2.0:
- users
- teams
- memberships
- grants
- login/session flows
- MCP token lifecycle

The structure should support:
- team collaboration
- project-scoped authorization
- token-based MCP access
- future SSO evolution
- clear boundaries from `core-api`

## Recommended Framework
- NestJS
- Fastify adapter
- Prisma
- PostgreSQL

## Architectural Role
`auth-access` is the owner of:
- who the user is
- what teams they belong to
- what grants they have
- what MCP tokens exist
- what scopes those tokens allow

It should **not** own project/work domain state.
It should provide identity and authorization capabilities to the rest of the platform.

## Actual Current Layout

The real `apps/auth-access/src/modules/` (verified) has no `audit` module and no `integrations/` directory, and adds `team-invites` (not originally scoped here):

```text
apps/auth-access/
  src/
    main.ts
    app.module.ts
    common/
    modules/
      auth/
      grants/
      health/
      memberships/
      sessions/
      team-invites/
      teams/
      tokens/
      users/
  package.json
  tsconfig.json
```

## Module Breakdown

### 1. `users`
Owns:
- user CRUD where applicable
- profile data
- account status
- internal identity metadata

Key responsibilities:
- create/read/update user records
- expose current user info
- manage disabled/suspended state

### 2. `teams`
Owns:
- team CRUD
- team metadata
- ownership/admin relationships

Key responsibilities:
- create/read/update teams
- manage team-level visibility metadata
- expose team listings and details

### 3. `memberships`
Owns:
- user-to-team membership
- membership roles
- membership lifecycle

Key responsibilities:
- add/remove users from teams
- resolve user team membership
- manage active/inactive membership state

### 4. `grants`
Owns:
- project-scoped grants
- grant creation/revocation
- grant resolution logic
- permission evaluation support

Key responsibilities:
- assign grants to users/teams
- revoke grants
- answer permission checks
- expose effective grant views where needed

This is one of the most important modules in the service.

### 5. `tokens`
Owns:
- MCP token issuance
- token revocation
- token hashing/storage
- token scope metadata
- token lifecycle status

Key responsibilities:
- create token
- revoke token
- list active tokens
- validate scope claims
- support expiration policies

### 6. `sessions`
Owns:
- login session lifecycle
- session storage/lookup
- logout/invalidation
- future refresh session behavior

### 7. `auth`
Owns:
- login flows
- credential verification
- current principal resolution
- auth guards support
- future OIDC/SSO adapters

Key responsibilities:
- authenticate user credentials
- issue auth/session context
- bridge toward future SSO support cleanly

### 8. `health`
Owns:
- health checks
- readiness/liveness
- dependency status

### 9. `team-invites`
Owns:
- invite creation/lookup/acceptance for a team
- invite tokens
- invite lifecycle (pending/accepted/revoked)

There is no dedicated `audit` module in the real service — access-related audit events are not (yet) split out on their own.

## Common Layer

### `common/crypto`
Contains:
- password hashing helpers
- token hashing helpers
- secure comparison utilities
- future signing helpers if needed

### `common/guards`
Contains:
- authenticated request guards
- role/grant guards for auth service endpoints

### `common/decorators`
Contains:
- current principal decorators
- request identity extraction helpers

### `common/pipes`
Contains:
- validation helpers
- parsing helpers

### `common/filters`
Contains:
- auth error mapping
- access denial mapping
- domain error -> HTTP response mapping

Important rule:
Keep auth/access domain logic inside modules, not hidden inside `common/`.

## Integration Layer

There is no dedicated `integrations/` directory in the real service. Any project existence checks / project metadata lookups toward `core-api` (when issuing project-scoped grants) live inside the relevant module today.

Important rule:
`auth-access` may verify project references, but must not own project data.

## Data Access Strategy
Use Prisma as the main ORM.

Recommended split:
- mutation flows in module services
- permission resolution helpers in dedicated grant services
- richer audit/security queries in query services when needed

Examples:
- `grants.service.ts` -> create/revoke grant flows
- `grants.query.service.ts` -> effective grant lookup
- `tokens.service.ts` -> issue/revoke/validate token

## API Design Recommendation
Expose REST endpoints grouped by access domain.

Real routes (verified against the controllers):
- `/auth/login`
- `/auth/logout`
- `/auth/me`
- `/users`
- `/teams`
- `/teams/:id/memberships`
- `/tokens` (`POST`/`GET`), `/tokens/validate`, `DELETE /tokens/:id` (revoke)
- `/grants` (`POST`/`GET`), `GET /grants/check`, `DELETE /grants/:id`
- `POST teams/:teamId/invites`, `GET teams/:teamId/invites`, `DELETE invites/:id`, `GET invites/by-token/:token`, `POST invites/by-token/:token/accept`

## Grant and Permission Strategy
Use explicit RBAC/grant logic backed by project grants.

Recommended model:
- users belong to teams
- grants may be attached to users or teams
- effective permission is resolved from:
  - direct user grants
  - team-derived grants
  - service-level/system rules where needed

Important:
Permission resolution must be inspectable and explainable.
Do not build a black-box access model.

## Token Strategy
MCP tokens should be:
- hashed at rest
- scoped
- revocable
- optionally expiring
- auditable

Suggested token metadata:
- owner type/id
- scope list
- status
- created at
- expires at
- revoked at
- last used at

## Rules To Lock In

### Rule 1
`auth-access` owns identity and permission truth.

### Rule 2
Other services must not invent grant rules locally.

### Rule 3
MCP token validation should depend on `auth-access`, not on ad-hoc token checks elsewhere.

### Rule 4
Security-relevant events must be auditable.

### Rule 5
Future SSO should be additive, not force a rewrite of the whole service.

## Likely First Modules To Implement
For the earliest wave, prioritize:
1. `users`
2. `teams`
3. `memberships`
4. `grants`
5. `tokens`
6. `auth`
7. `sessions`
8. `health`

Then add (now implemented):
9. `team-invites`

## Final Recommendation
The `auth-access` service should be a dedicated identity and authorization backend for Roadboard 2.0.

It must be strong enough to support:
- team collaboration
- project-scoped grants
- safe MCP token access
- future growth toward more advanced enterprise auth

without polluting the core project/work domain.
