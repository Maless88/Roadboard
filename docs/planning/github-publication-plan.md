# Roadboard 2.0 GitHub Publication Plan

## Goal
Prepare Roadboard 2.0 to be publishable on GitHub as a serious public repository, with a standard open-source structure, clear documentation, contributor guidance, and a professional first impression.

The goal is not only to publish code.
The goal is to publish a repository that is understandable, credible, and maintainable for external readers and contributors.

## Publication Principles
- The repository must be understandable without private context.
- Core architectural choices must be documented clearly.
- Public documentation must explain what the product is, why it exists, and how to run it.
- Contributor expectations must be explicit.
- Sensitive internal assumptions must be removed before publication.
- The public repo should look intentional, not like an internal dump.

## Required Public Repository Artifacts

### 1. Root `README.md`
Must include:
- project name and one-sentence definition
- problem statement
- main features
- architecture overview
- monorepo overview
- local development quick start
- current project status
- links to deeper docs

### 2. `LICENSE`
Choose and add a license explicitly.

Recommended first decision:
- MIT if you want maximum reuse
- Apache-2.0 if you want patent protection language
- AGPL if you want strong copyleft/network use constraints

This decision should be made deliberately before public release.

### 3. `CONTRIBUTING.md`
Must explain:
- how to set up the repo
- branch/PR expectations
- coding conventions
- testing expectations
- documentation expectations
- commit/PR quality bar

### 4. `CODE_OF_CONDUCT.md`
Standard community conduct policy.

Recommended:
- Contributor Covenant

### 5. `SECURITY.md`
Must explain:
- how to report vulnerabilities
- supported versions if relevant
- what not to disclose publicly before fix

Important because Roadboard 2.0 includes:
- auth
- grants
- tokens
- MCP access
- sync behavior

### 6. `SUPPORT.md` or equivalent
Must explain:
- where to ask questions
- whether the project is best-effort or actively maintained
- how issues/discussions should be used

### 7. `CHANGELOG.md`
Should track meaningful public releases and notable changes.

### 8. `ROADMAP.md`
Public-facing roadmap, distinct from internal design docs.

Should explain:
- current milestone
- MVP goals
- major upcoming phases
- what is intentionally out of scope

### 9. `docs/`
Public docs should be organized clearly.

Recommended public doc categories:
- getting started
- architecture
- services
- MCP integration
- data model
- auth and permissions
- deployment
- contributing
- testing

## Documentation Layers Recommendation

### Public-facing docs
These should explain the product to outsiders.

Recommended files:
- `README.md`
- `ROADMAP.md`
- `docs/architecture/overview.md`
- `docs/getting-started/local-development.md`
- `docs/services/core-api.md`
- `docs/services/auth-access.md`
- `docs/services/mcp-service.md`
- `docs/services/local-sync-bridge.md`
- `docs/services/worker-jobs.md`
- `docs/domain/entities.md`
- `docs/testing/strategy.md`

### Internal design docs
The current `docs/roadboard2/` material can remain as deeper architecture/design notes.

Recommendation:
- keep them
- but distinguish between internal planning docs and public product docs

## Recommended Public README Structure

```text
# Roadboard

Short definition

## Why Roadboard exists

## Core capabilities

## Architecture at a glance

## Monorepo structure

## Quick start

## Documentation

## Current status

## Contributing

## License
```

## GitHub Repository Hygiene Requirements

### Must have
- meaningful repository description
- topics/tags
- logo or simple project mark later if desired
- issue templates
- pull request template
- CI status visible
- example `.env.example`
- no secrets in history

### Recommended `.github/` contents
```text
.github/
  workflows/
  ISSUE_TEMPLATE/
  PULL_REQUEST_TEMPLATE.md
```

#### Suggested issue templates
- bug report
- feature request
- documentation improvement
- MCP/tooling issue

#### Suggested PR template
Should ask for:
- what changed
- why
- testing done
- docs updated?
- breaking changes?

## Release Readiness Checklist
Before going public, confirm:
- no secrets or private endpoints remain
- no internal-only names/URLs remain
- no internal credentials/examples remain
- docs are coherent
- bootstrap works from zero
- tests run in CI
- license is present
- contribution/security docs exist

## Publishing Phases Recommendation

### Phase 1 - Public skeleton
- clean root docs
- add standard GitHub files
- publish architecture overview
- publish monorepo structure
- publish current status honestly

### Phase 2 - Developer usability
- local setup instructions
- env examples
- docker/dev bootstrap
- basic CI
- basic test documentation

### Phase 3 - Contributor friendliness
- issue templates
- PR template
- contribution guide
- architecture navigation docs

### Phase 4 - Public trust
- releases/changelog
- security policy
- clearer roadmap
- examples/demo assets

## Public Positioning Recommendation
The public repository should clearly say that Roadboard 2.0 is:
- a multi-project execution and memory platform
- built for humans and AI agents
- centered on planning, context continuity, collaboration, and MCP-aware access

This messaging should be consistent across README, repository description, and docs.

## Final Recommendation
Treat publication as a product workstream, not an afterthought.

The repository should be prepared with:
- standard GitHub open-source files
- strong README and docs
- CI and test visibility
- contribution and security guidance
- a public roadmap

before presenting it as a serious public project.
