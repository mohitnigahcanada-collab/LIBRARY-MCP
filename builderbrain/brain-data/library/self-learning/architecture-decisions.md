# Architecture Decisions

<!-- Format:
## [YYYY-MM-DD] Decision Title
**Context**: What situation prompted this decision
**Decision**: What was chosen
**Reason**: Why this option over alternatives
**Trade-offs**: Known downsides accepted
-->

## [2026-05-20] Use markdown files for knowledge library
**Context**: Needed a storage format for knowledge that is human-readable, editable by hand, and requires no database
**Decision**: All knowledge stored as markdown files in brain-data/library/
**Reason**: Zero dependencies, git-trackable, readable without tooling, matches builder workflow
**Trade-offs**: No semantic search in v1; search is keyword-based only

## [2026-05-20] Use Hono for local API
**Context**: Needed a lightweight Node.js HTTP framework for the local API server
**Decision**: Hono with @hono/node-server adapter
**Reason**: Typed, fast, minimal, works well with TypeScript ESM, small bundle
**Trade-offs**: Less ecosystem than Express, but sufficient for v1 local API

## [2026-05-20] No database in v1
**Context**: Considered SQLite or JSON files for run logs and memory
**Decision**: JSON files for run logs, markdown for memory
**Reason**: Keeps v1 dependency-free; files are inspectable without tools; git-trackable
**Trade-offs**: No query capability beyond file reads; scales poorly past thousands of logs (acceptable for v1)
