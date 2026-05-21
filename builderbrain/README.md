# BuilderBrain

Local-first AI engineering brain — context, proposals, memory, and verified execution.

> Boring, working, verified v1 beats advanced, broken, imaginary v5.

## What It Does

Before any AI agent codes, BuilderBrain:
1. Classifies the task domain (auth, database, security, etc.)
2. Selects a relevant book stack from the knowledge library
3. Builds a structured context pack
4. Calculates risk (Low / Medium / High / Critical) and confidence (0–100)
5. Flags tasks that require approval before execution
6. Saves lessons to self-learning memory after every resolved problem

## Install

```bash
cd builderbrain
npm install
npm run build
npm link  # makes `brain` and `brain-mcp` available globally
```

## CLI Commands

```bash
brain context "add JWT auth to express app"     # Build context pack
brain propose "add JWT auth to express app"     # Full proposal with risk/confidence
brain learn                                      # Save a lesson (interactive)
brain status                                     # System status
brain books                                      # List knowledge library
brain runs                                       # Recent run logs
brain init                                       # Initialize brain-data/ folder
brain serve                                      # Start local API (port 3737)
```

## Local API

Start: `brain serve` or `npm run serve`

| Method | Endpoint       | Description                          |
|--------|----------------|--------------------------------------|
| GET    | /status        | System status                        |
| GET    | /books         | List all knowledge books             |
| GET    | /library       | Full library content                 |
| GET    | /book?path=... | Read a specific book                 |
| GET    | /runs          | Recent run logs                      |
| GET    | /runs/:id      | Single run log                       |
| POST   | /context       | Build context pack `{ task }`        |
| POST   | /propose       | Generate proposal `{ task }`         |
| POST   | /chat          | Chat with configured AI backends     |
| GET    | /chat/history  | List persisted conversation history   |
| GET    | /chat/history/:id | Get a conversation transcript      |
| POST   | /learn         | Save lesson `{ task, problem, rootCause, solution, evidence }` |

## MCP Tools

Four tools are available for MCP clients:

| Tool | Description |
|---|---|
| `brain_context_pack` | Build a context pack for a task |
| `brain_propose` | Generate a proposal with risk/confidence |
| `brain_save_lesson` | Save a lesson to self-learning memory |
| `brain_status` | Get system status |

## Real MCP Server (stdio)

Run it directly:

```bash
npm run dev:mcp
```

Or after build:

```bash
brain-mcp
```

### OpenCode setup (local MCP)

Add this to your OpenCode config under `mcp`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "builderbrain": {
      "type": "local",
      "command": ["brain-mcp"],
      "enabled": true
    }
  }
}
```

Then verify:

```bash
opencode mcp list
```

## Knowledge Library Structure

```
brain-data/library/
├── pocket-rules/          # Core rules always included in every context pack
│   ├── before-coding.md
│   ├── before-debugging.md
│   ├── approval-rules.md
│   └── memory-rules.md
├── mini-book/             # Domain knowledge books
│   ├── software-engineering.md
│   ├── debugging.md
│   ├── testing.md
│   ├── ai-agents.md
│   ├── security.md
│   └── product-building.md
├── self-learning/         # Automatically updated by `brain learn`
│   ├── solved-problems.md
│   ├── failed-attempts.md
│   ├── bug-patterns.md
│   ├── architecture-decisions.md
│   ├── reusable-fixes.md
│   └── improvement-log.md
└── user-style/            # Your preferences (no sensitive data)
    ├── communication-style.md
    ├── decision-style.md
    ├── do-not-ask-rules.md
    └── safe-memory-only.md
```

## Risk Levels

| Level    | Approval Required | Examples                        |
|----------|------------------|---------------------------------|
| Low      | No               | New files, helper functions     |
| Medium   | No               | Feature changes, new routes     |
| High     | Yes              | Deletions, auth changes, deploys |
| Critical | Yes              | Drop DB, wipe data, prod deploy |

## Tests

```bash
npm test          # 34 tests across 5 test files
npm run build     # TypeScript compile
```

## v1 Scope

**Included**: CLI, local API, real stdio MCP server, markdown knowledge library, context pack builder, proposal engine, risk/confidence scoring, self-learning memory, user-style memory, run logs, Vitest tests.

**Excluded (v2+)**: GitHub repo cloning, vector DB, Google Drive sync, cloud deployment, full multi-agent orchestration.

## Known Limitations

- No semantic/vector search — domain classification is keyword-based
- Dashboard not included in v1 (planned for v2)
- No authentication on local API (local-only by design)
- Run logs are plain JSON files; no query interface beyond listing
