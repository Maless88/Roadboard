---
name: serena-nav
description: Navigate and edit code with Serena (LSP-backed semantic tools) instead of grep/ripgrep/Read. Use whenever you need to find a symbol definition, find usages/call sites, understand a file's structure, or make structured code edits in a repo.
---

# Serena — semantic code navigation & editing

When Serena MCP is available it is the ONLY permitted tool for semantic navigation and structured edits.

## Bootstrap (once per session)
1. `mcp__serena__check_onboarding_performed` — verify Serena is active/onboarded on the current project.
2. If not onboarded → `mcp__serena__onboarding` and wait for it to finish.
3. If Serena is unavailable/errors → fall back to grep/Read but ANNOUNCE the degraded mode explicitly.

## Prohibited (for code symbols)
- grep / ripgrep / Grep to find definitions or usages of functions, classes, types, components.
- cat / Read of a whole file just to locate a symbol.
- find / Glob to discover where a type/function lives.
These miss re-exports, trait impls, type aliases, barrel files, and produce line-fragile edits.

## Required tools
| Need | Tool |
|---|---|
| Where a symbol is defined | `mcp__serena__find_symbol` (include_body=false) |
| Body of a symbol | `mcp__serena__find_symbol` (include_body=true) |
| Structure of a file | `mcp__serena__get_symbols_overview` |
| All usages / call sites | `mcp__serena__find_referencing_symbols` |
| Uncertain symbol name | `mcp__serena__search_for_pattern` |
| Replace a symbol body | `mcp__serena__replace_symbol_body` |
| Insert before/after a symbol | `mcp__serena__insert_before_symbol` / `insert_after_symbol` |

## grep is allowed only for
Non-semantic searches: string literals, config keys, env var names, comments, file names, paths. Never for code symbols.
