# Roadboard 2.0 Plan

## 1. Project Goal
Design and build a new version of Roadboard focused on the parts that proved genuinely useful in practice, while rethinking the structure around planning, decision tracking, and reusable project memory for multiple AI coding assistants.

## 2. Strategic Positioning
Roadboard 2.0 should sit between:
- roadmap/task management
- project context management
- decision logging
- AI-readable memory retrieval

It should not be only a board, and it should not become a black-box memory dump.

## 3. Design Principles
- Human-first, agent-compatible
- Local-first or portable by default
- Structured before magical
- Explicit knowledge before opaque summarization
- Multi-agent by design (Claude Code, Codex, future tools)
- Clear separation between durable knowledge and temporary working context
- Retrieval must be inspectable and controllable

## 4. Product Scope
### In scope
- project roadmap and active work tracking
- decision records
- memory entries and retrieval
- links between tasks, decisions, files, and sessions
- export/adaptation for different AI agents

### Out of scope for MVP
- highly autonomous agent orchestration
- heavy semantic pipelines by default
- complex enterprise permissions
- full collaboration suite parity with Jira/Linear/Notion

## 5. Core Functional Areas
### A. Planning Layer
- roadmap items
- epics
- tasks
- statuses
- priorities
- milestones

### B. Knowledge Layer
- architectural decisions
- conventions
- known issues
- experiments
- lessons learned
- implementation notes

### C. Memory Layer
- curated memory entries
- session summaries
- retrieval by relevance
- AI-oriented context bundles

### D. Integration Layer
- Git integration
- repo metadata linkage
- agent-specific exports/prompts
- optional editor integrations

## 6. Proposed Information Model
### Primary entities
- Project
- RoadmapItem
- Task
- Decision
- MemoryEntry
- Session
- Experiment
- FileReference
- Tag
- Link

### Example relations
- Task -> relates_to -> Decision
- Decision -> supported_by -> MemoryEntry
- Session -> produced -> MemoryEntry
- FileReference -> impacted_by -> Task
- RoadmapItem -> contains -> Task

## 7. Memory Model
### Memory categories
- decision
- architecture
- bug
- experiment
- convention
- operational note
- retrospective insight
- open question

### Memory properties
- title
- body
- category
- project
- tags
- source
- confidence
- created_at
- updated_at
- related_entities
- durability (temporary / durable)

### Memory rules
- not every event becomes memory
- memory should be reviewable by humans
- durable memory should be explicit
- temporary working memory should expire or archive

## 8. Multi-Agent Strategy
Create a neutral internal representation, then build adapters for:
- Claude Code
- Codex
- future agents

Potential outputs:
- project summary files
- task-focused context bundles
- decision digests
- session handoff summaries
- agent-specific instruction overlays

## 9. MVP Definition
### MVP objective
Deliver a usable system that improves continuity across sessions and makes project context easier to retrieve for both humans and AI tools.

### MVP features
- projects
- roadmap items / tasks
- decisions
- memory entries
- search/filter
- links between objects
- export of project context for AI assistants

### Optional for MVP if low effort
- session summaries
- simple Git references

## 10. Architecture Draft
### Option A: file-first
- markdown/yaml/json stored in repo
- simple indexer
- lightweight local app/UI

Pros:
- transparent
- Git-friendly
- portable

Cons:
- harder querying at scale
- more fragile schema evolution

### Option B: DB-backed local app
- SQLite or Postgres
- richer querying and relations
- export/import to files

Pros:
- stronger querying
- better structured retrieval

Cons:
- more moving parts
- less repo-native

### Recommendation
Start with a hybrid-friendly design:
- canonical structured objects
- easy export/import
- ability to support both file and DB storage later

## 11. Retrieval Approach
### Phase 1
- structured filters
- tags
- entity links
- text search

### Phase 2
- relevance scoring
- project summaries
- optional semantic retrieval

### Important constraint
Retrieval must remain debuggable. The user should understand why a memory was selected.

## 12. User Workflow Goals
- capture important decisions quickly
- find active context fast
- hand off work between sessions cleanly
- generate focused context packages for a selected task or project
- keep roadmap and memory linked without mixing them into one noisy screen

## 13. Validation Criteria
Roadboard 2.0 is successful if it reduces:
- repeated re-explanation of project context
- loss of rationale behind past decisions
- time spent reconstructing state at session start
- fragmentation across notes, commits, and chats

And improves:
- task continuity
- decision visibility
- agent handoff quality
- reuse of project knowledge

## 14. Technical Questions To Resolve
- best canonical schema format?
- file-first or DB-first for v1?
- how much automation in memory capture?
- how to model sessions and handoffs?
- how to keep agent adapters thin and maintainable?

## 15. Roadmap
### Phase 0 - Discovery
- analyze current Roadboard honestly
- identify useful vs useless parts
- define object model
- define MVP

### Phase 1 - Foundation
- implement core entities
- implement roadmap/task layer
- implement decision records
- basic search and relations

### Phase 2 - Memory
- implement memory entries
- add review flow
- add project summaries and handoff concepts

### Phase 3 - Agent integration
- Claude Code adapter
- Codex adapter
- project context export bundles

### Phase 4 - Refinement
- better retrieval
- UX cleanup
- archive/decay rules
- optional semantic layer

## 16. Initial Recommendation
Do not begin by cloning claude-mem feature-for-feature.

Instead:
1. identify the exact memory behaviors you want
2. define a neutral Roadboard-native model
3. support Claude Code and Codex as consumers of that model
4. only later add automation and smarter retrieval

## 17. Open Questions
- Is Roadboard 2.0 a per-project tool or a personal knowledge platform?
- Should memory be globally queryable across projects?
- Should there be a dedicated ADR-like decision system?
- Should sessions be explicit objects from day one?
