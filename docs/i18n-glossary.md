# i18n Glossary — RoadBoard 2.0

Canonical IT/EN term mapping for all user-facing strings in `apps/web-app/src/lib/i18n/`.

## Rules

- Keys in the dictionaries are NEVER changed (no i18n type-system break).
- Only `values` are standardized.
- Mixed-language values in the IT dictionary are allowed ONLY for proper nouns
  (product names: Claude Code, Zed, VS Code, RoadBoard) and technical identifiers
  (MCP, HTTP, stdio, JSON, YAML, TOML, API key, slug).
- Terms marked **keep-EN** in the IT column are intentionally left in English because
  they are established technical terms with no natural Italian equivalent in common use.

## Canonical Term Table

| Concept            | IT canonical         | EN canonical         | Notes                                              |
|--------------------|----------------------|----------------------|----------------------------------------------------|
| project            | progetto             | project              |                                                    |
| task               | task                 | task                 | keep-EN in IT — established term                   |
| phase              | fase                 | phase                |                                                    |
| decision           | decisione            | decision             | "decision" (EN) stays in event strings             |
| memory entry       | voce di memoria      | memory entry         | "memory" alone → "memoria" in prose                |
| memory (noun/tab)  | Memoria              | Memory               | tab label canonical                                |
| memory log         | registro memoria     | memory log           |                                                    |
| annotation         | annotazione          | annotation           |                                                    |
| node               | nodo                 | node                 |                                                    |
| edge               | arco                 | edge                 |                                                    |
| link               | collegamento         | link                 | "link" as verb → "collega/collegare"               |
| repository         | repository           | repository           | keep-EN in IT                                      |
| group              | gruppo               | group                |                                                    |
| domain group       | gruppo di dominio    | domain group         |                                                    |
| scope              | scope                | scope                | keep-EN in IT — technical term                     |
| member             | membro               | member               |                                                    |
| owner              | proprietario         | owner                |                                                    |
| archive (verb)     | archivia             | archive              | always lowercase when used as standalone verb      |
| archive (noun/adj) | archiviato           | archived             |                                                    |
| snapshot           | snapshot             | snapshot             | keep-EN in IT — technical term                     |
| drift              | drift                | drift                | keep-EN in IT — technical term                     |
| impact             | impatto              | impact               |                                                    |
| impact: low        | Impatto: basso       | Impact: low          |                                                    |
| impact: medium     | Impatto: medio       | Impact: medium       |                                                    |
| impact: high       | Impatto: alto        | Impact: high         |                                                    |
| status: open       | aperta               | open                 | for decisions; keep EN for status enums in forms   |
| status: accepted   | accettata            | accepted             |                                                    |
| status: rejected   | rifiutata            | rejected             |                                                    |
| status: superseded | superata             | superseded           |                                                    |
| contributor        | contributor          | contributor          | keep-EN in IT — established term                   |
| token              | token                | token                | keep-EN in IT                                      |
| endpoint           | endpoint             | endpoint             | keep-EN in IT                                      |
| handoff            | handoff              | handoff              | keep-EN in IT — MCP protocol term                  |
| onboarding         | onboarding           | onboarding           | keep-EN in IT                                      |
| workflow           | workflow             | workflow             | keep-EN in IT                                      |
| settings           | Impostazioni         | Settings             |                                                    |
| dashboard          | Dashboard            | Dashboard            | keep-EN in both — product term                     |

## Incoerenze corrette in questo pass

### IT dictionary

1. `codeflow.drawer.tabMemory` "Memory" → "Memoria" (era EN in un dict IT).
2. `codeflow.drawer.noMemory` "Nessuna memory entry collegata." → "Nessuna voce di memoria collegata."
3. `forms.searchPlaceholder` "Cerca nella memory…" → "Cerca nella memoria…"
4. `forms.memorySearchPlaceholder` "Cerca nel memory log…" → "Cerca nel registro memoria…"
5. `activity.events['memory.created']` "ha scritto la memory" → "ha scritto la voce di memoria"
6. `activity.events['memory.updated']` "ha aggiornato la memory" → "ha aggiornato la voce di memoria"
7. `activity.events['memory.deleted']` "ha eliminato la memory" → "ha eliminato la voce di memoria"
8. `forms.impactLow` "Impatto: low" → "Impatto: basso"
9. `forms.impactMedium` "Impatto: medium" → "Impatto: medio"
10. `forms.impactHigh` "Impatto: high" → "Impatto: alto"
11. `decision.noPhasesLinked` "Nessuna fase collegata a questa decision." → "Nessuna fase collegata a questa decisione."
12. `forms.noDecisionLinked` "Nessuna decision collegata" → "Nessuna decisione collegata"
13. `project.noMemory` "Nessuna entry ancora." → "Nessuna voce di memoria ancora."
14. `forms.createMemory` "+ Nuova entry" → "+ Nuova voce di memoria"

### EN dictionary

1. `project.noMemory` "No entries yet." → "No memory entries yet."
2. `forms.createMemory` "+ New entry" → "+ New memory entry"
