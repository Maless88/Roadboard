# Roadboard 2.0 Brainstorm

## Vision
Rebuild Roadboard from scratch as a cleaner, more useful system focused on what proved genuinely valuable in real usage.

## Core idea
Roadboard 2.0 should not be only a task board. It should combine:
- roadmap and execution tracking
- architectural and product context
- decision history
- memory retrieval for AI tools
- support for more than one coding assistant (Claude Code, Codex, and potentially others)

## 1. Current Roadboard Retrospective
- Which parts of the current Roadboard are truly useful in daily work?
- Which parts are used only occasionally?
- Which parts create friction or maintenance cost?
- Which parts were conceptually right but implemented poorly?
- Which features looked good on paper but were not actually valuable?
- What information is currently hard to find quickly?
- What kinds of project context are repeatedly lost between sessions?

## 2. Product Goal
- Is Roadboard 2.0 mainly a planning tool, a memory system, or both?
- Should it be project-centric, repo-centric, or workspace-centric?
- Should it support single-user first or multi-user first?
- Should the main audience be developers, AI agents, or both equally?
- Should it act as the source of truth for active work?

## 3. Problems to Solve
- How do we avoid losing context across sessions?
- How do we preserve decision rationale, not just tasks?
- How do we make an AI agent understand the current project state quickly?
- How do we support multiple agents without vendor lock-in?
- How do we prevent memory from becoming noisy and useless?
- How do we distinguish durable knowledge from temporary notes?

## 4. Roadboard vs Memory Layer
- What belongs to the board layer?
- What belongs to the memory layer?
- What belongs to project docs instead?
- How should tasks, plans, decisions, and observations be linked?
- Should memory entries be first-class objects or derived from other artifacts?

## 5. Memory System Requirements
- Should memory be local-first?
- Should memory be file-based, DB-based, or hybrid?
- Should retrieval be keyword-based, semantic, or both?
- Should memory be manually curated, automatically captured, or mixed?
- Should memory support categories such as decisions, bugs, architecture, conventions, experiments, and learnings?
- Should memory have decay/archive rules?
- Should memory be explainable and inspectable by humans?

## 6. Multi-Agent Support
- What format should be readable by Claude Code and Codex without tool-specific lock-in?
- Should there be a neutral canonical format, then exporters/adapters for each agent?
- Should prompts and memory policies be agent-specific overlays?
- Which metadata is useful across all agents?
- How do we avoid a design that is too tied to one vendor's workflow?

## 7. Data Model Ideas
Possible entities:
- projects
- epics
- tasks
- roadmap items
- decisions
- memory entries
- experiments
- incidents
- files/modules
- sessions
- agent interactions
- tags and relations

Questions:
- Which entities are essential in v1?
- Which relations are necessary?
- What should have history/versioning?
- What should be immutable once recorded?

## 8. UX / Workflow Questions
- What is the main screen?
- Should the user start from roadmap, active tasks, or project memory?
- How much information should be visible by default?
- How do we expose high-value context without clutter?
- How should search work?
- How should the system surface "what changed recently"?
- How should an AI session handoff work?

## 9. Capture and Retrieval
- How are memories created?
- Should the system auto-suggest memories after commits or sessions?
- Should there be a review queue for proposed memories?
- How should retrieval rank relevance?
- When should the system load memory automatically versus on-demand?
- Should there be project summaries that evolve over time?

## 10. Technical Constraints
- Preferred stack?
- DB or file-first?
- Need offline mode?
- Need Git integration?
- Need editor integration?
- Need API-first design?
- Need import/export?
- Need fine-grained permissions?

## 11. Minimum Viable Product
- What is the smallest version that is actually useful?
- Can MVP be only:
  - roadmap items
  - decisions
  - memory entries
  - search
  - AI-oriented context export?
- What can wait for v2?

## 12. Risks
- Overengineering
- Too much automatic capture producing noise
- Poor retrieval quality
- Complex schema that slows down usage
- UX that mixes planning and memory badly
- Building for agents instead of for humans
- Building for one agent and regretting it later

## 13. Open Questions
- Should Roadboard 2.0 live inside each repo or as a separate central service?
- Should memory be globally shared across projects or isolated per project?
- How much should be explicit docs vs generated summaries?
- Is RAG really needed, or is structured memory enough initially?
- Should there be a formal notion of "decision record" and "working memory"?

## Notes
Dump raw ideas here.
