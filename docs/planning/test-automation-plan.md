# Roadboard 2.0 Test Automation Plan

## Goal
Define a serious automated testing strategy for Roadboard 2.0.

The objective is not to add tests symbolically.
The objective is to create a testing system that protects:
- service boundaries
- auth and grant logic
- MCP tool correctness
- sync reliability
- dashboard correctness
- public repository credibility

## Testing Principles
- Test the architecture, not only functions.
- Permission and token logic must be tested explicitly.
- MCP contracts must be tested as first-class surfaces.
- Sync and retry logic must be tested as reliability features.
- Critical user-facing workflows need end-to-end coverage.
- CI must run enough tests to prevent regressions without becoming unusably slow.

## Testing Pyramid Recommendation

### 1. Unit tests
Fast tests for:
- pure domain helpers
- validators
- grant resolution helpers
- token helpers
- DTO mapping
- retry/idempotency policies
- small workflow policies

### 2. Integration tests
Service-level tests for:
- API modules with real DB/test containers
- auth and grant enforcement
- MCP tool handlers against mocked or test services
- worker job processors
- local sync bridge storage and journaling

### 3. Contract tests
Contract-focused tests for:
- MCP tool schemas
- core-api endpoint contracts
- auth-access token/grant responses
- shared DTO and package compatibility

### 4. End-to-end tests
Real flow tests for:
- login -> project access -> task updates
- task + memory + decision workflows
- MCP read/write workflow behavior
- dashboards reflecting project state
- local sync bridge pushing to central state

## Service-Specific Testing Strategy

### `core-api`
Must have:
- unit tests for domain helpers
- integration tests for modules
- permission-aware API tests
- query correctness tests for dashboard-related reads

Critical areas:
- task status transitions
- memory creation and linking
- decision creation and linking
- project/phase/milestone relationships

### `auth-access`
Must have:
- token lifecycle tests
- grant resolution tests
- team membership tests
- permission evaluation tests
- login/session tests

Critical areas:
- revocation behavior
- scope enforcement
- effective grant resolution from user + team grants
- auth failure behavior

### `mcp-service`
Must have:
- MCP contract tests per tool
- denied action tests
- token scope tests
- workflow tool orchestration tests
- downstream failure handling tests

Critical areas:
- read tool correctness
- write tool guardrails
- workflow tool safety
- audit emission for writes and denials

### `local-sync-bridge`
Must have:
- SQLite persistence tests
- journal write tests
- retry/backoff tests
- conflict/denial visibility tests
- sync success/failure tests

Critical areas:
- pending operation durability
- replay/retry safety
- explicit failure state visibility
- local snapshot refresh correctness

### `worker-jobs`
Must have:
- job processor tests
- idempotency tests
- retry tests
- projection correctness tests
- cleanup safety tests

Critical areas:
- dashboard refresh jobs
- handoff/summary job correctness
- token cleanup behavior
- no illegal mutation of canonical entities

### `web-app`
Must have:
- component tests where useful
- page-level integration tests
- end-to-end tests with Playwright

Critical areas:
- dashboard visibility
- project/task/memory views
- auth and access behavior in UI
- token/admin flows

## Recommended Tooling

### Unit / integration tests
- Vitest for unit and service-level tests where possible

### API / service integration
- test containers or Docker-based test services for PostgreSQL and Redis
- supertest for NestJS HTTP integration testing where applicable

### End-to-end UI tests
- Playwright

### Contract validation
- schema-based validation using shared contracts
- dedicated MCP contract test suite

### Coverage
- use coverage reports, but do not optimize for vanity percentages alone

## Environment Strategy

### Local developer test environment
Should support:
- PostgreSQL test instance
- Redis test instance
- isolated test databases
- repeatable seed/reset

### CI environment
Should support:
- per-service test jobs
- affected-only fast checks when possible
- nightly or slower full integration/e2e passes if needed later

## Test Layers By Package/Boundary

### `packages/domain`
Test:
- enums/constants invariants if needed
- domain helper logic
- shared validation helpers

### `packages/grants`
Test:
- permission matrix behavior
- grant merge logic
- effective access resolution

### `packages/auth`
Test:
- token hashing/verification
- session helper behavior
- expiry handling

### `packages/mcp-contracts`
Test:
- schema validity
- contract compatibility
- required/optional field correctness

### `packages/api-contracts`
Test:
- DTO compatibility
- generated client/schema consistency

## Critical End-to-End Scenarios
The following flows should become automation priorities.

### Scenario 1: human project workflow
- login
- create project
- create phase
- create milestone
- create task
- add memory
- add decision
- verify dashboard visibility

### Scenario 2: grant enforcement
- user without grant cannot mutate project
- team grant allows access
- revoked grant removes access

### Scenario 3: MCP read flow
- token valid
- tool allowed
- project/task context returned correctly

### Scenario 4: MCP write flow
- token valid
- scoped write allowed
- task/memory/decision write succeeds
- audit recorded

### Scenario 5: MCP denied flow
- token revoked or insufficient scope
- write denied cleanly
- denial audited

### Scenario 6: local sync flow
- create local pending operation
- sync succeeds centrally
- local journal updated
- central state reflects change

### Scenario 7: retry/failure flow
- central service unavailable
- journal retains pending op
- retry happens safely
- duplicate effects do not occur

## CI Pipeline Recommendation

### Pull request pipeline
Run:
- lint
- typecheck
- unit tests
- targeted integration tests for changed services/packages

### Main branch pipeline
Run:
- full service integration tests
- contract tests
- selected end-to-end tests

### Scheduled pipeline
Later, optionally run:
- heavier e2e suites
- broader sync/reliability tests
- longer worker-job suites

## Suggested Repository Test Layout

```text
apps/
  core-api/
    test/
      integration/
      e2e/
  auth-access/
    test/
      integration/
      e2e/
  mcp-service/
    test/
      integration/
      contract/
  local-sync-bridge/
    test/
      integration/
      sync/
  worker-jobs/
    test/
      integration/
      jobs/
  web-app/
    tests/
      e2e/
packages/
  grants/
    test/
  auth/
    test/
  mcp-contracts/
    test/
```

## Quality Gates Recommendation
A pull request should not be considered healthy unless:
- lint passes
- typecheck passes
- changed service tests pass
- changed contract tests pass
- documentation is updated when behavior changes materially

## Public Credibility Recommendation
If Roadboard 2.0 is meant to be publishable on GitHub, automated testing must be visible and real.

Recommended public signals:
- CI badge in README
- testing strategy doc
- reproducible local test commands
- clear statement of what is covered vs not yet covered

## Final Recommendation
Treat test automation as a first-class workstream.

For Roadboard 2.0, automated testing must protect the riskiest parts of the platform:
- auth and grants
- MCP tools and scopes
- local sync reliability
- dashboards and summaries
- service boundaries

The right approach is layered:
- unit tests for logic
- integration tests for services
- contract tests for APIs and MCP tools
- end-to-end tests for real user and agent workflows
