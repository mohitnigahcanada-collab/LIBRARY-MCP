# BuilderBrain — Progress Log

**Last updated:** 2026-05-20  
**Version:** 2.0.0  
**Branch:** `main`  
**Port:** 8765

---

## What Is BuilderBrain?

A local-first personal AI library that runs on your machine at `http://localhost:8765`.  
It powers coding agents (Claude Code, OpenCode, Cursor) via MCP/API AND works as a standalone chat AI that knows your personal knowledge library.

One app. One port. Five modes: **Agent · Chat · Research · Library · Ops · Settings**

---

## Completed ✅

### v1 — Core Engine (fully working, 34/34 tests)
- 14-domain keyword classifier (auth, backend, frontend, database, security, deployment, testing, performance, ai, files, devops, product, browser, mobile)
- Book router — selects relevant library books per task
- Risk/confidence scorer — Low/Medium/High/Critical with reasons
- Context pack builder — structured JSON for coding agents
- Proposal engine — full task proposal with approval gates
- Self-learning memory — saves lessons, reads prior lessons into context
- User style memory — communication style, decision style, do-not-ask rules
- JSON run logger — every command logged with timestamp, domains, risk, books
- CLI: `brain context/propose/learn/status/books/runs/init/serve`
- REST API: 10+ endpoints at port 8765
- MCP skeleton: 4 tools (`brain_context_pack`, `brain_propose`, `brain_save_lesson`, `brain_status`)
- 20 seeded knowledge books across 4 categories

### v2 — Dashboard + Multi-AI (fully working)
- React + Vite dashboard served at `http://localhost:8765`
- **6 modes:** Agent, Chat, Research, Library, Ops, Settings
- **Multi-AI router** — add 5+ OpenAI-compatible backends, smart fallback, never stops
- **Config manager** — `brain-data/config.json` (gitignored), stores API keys securely
- **CORS** — dashboard talks to API cleanly
- **Static serving** — Hono serves built dashboard at `/*`

### Bug Fixes
- `npm start` was exiting immediately (startServer() never called) — **fixed**
- CLI `serve` default port was 3737 instead of 8765 — **fixed**

### One-Click Launchers
- `LaunchBrain.sh` — Linux/Arch/Cachyos (xdg-open, firefox, chromium fallback)
- `LaunchBrain.command` — macOS double-click
- `LaunchBrain.bat` — Windows

### Chat AI Fixed
- AI now has a **strong always-on system prompt** — knows it's BuilderBrain, not a generic LLM
- Lists all 20 library books in every chat context
- Gives `git clone` commands instead of saying "I can't download repos"
- **Persistent chat history** — localStorage, last 50 conversations in sidebar
- Suggestion chips on empty state
- Task context moved to header bar

### Agentic Repo Cloning ← NEW
- `POST /repo/clone` — actually runs `git clone --depth=1` on user's machine
- `GET /repos` — lists all cloned repos in library
- **Chat auto-detects** GitHub URLs + clone intent (download/add/get/fetch)
- Clones happen server-side before AI responds — AI confirms what happened
- Repos saved to `brain-data/big-bible/repos/`

---

## How to Start

```bash
# Linux (Arch/Cachyos)
cd ~/Desktop/LIBRARY-MCP
chmod +x LaunchBrain.sh
./LaunchBrain.sh

# Or manually
cd builderbrain
npm install
npm run build:all
npm start
# → http://localhost:8765
```

---

## Pending / Next Steps 🔜

### High Priority
- [ ] **Daily trend radar** — auto-search GitHub trending, send Telegram alert, approval queue
- [ ] **Task queue system** — `GET /tasks`, `POST /tasks/:id/execute`, queue panel in dashboard
- [ ] **Telegram/Slack alerts** — config fields exist, sending logic not yet implemented
- [ ] **Library mode in chat** — show cloned repos in Library tab alongside books
- [ ] **Repo analysis** — after clone, auto-summarize README + extract patterns

### Medium Priority
- [ ] **Research mode backend** — real GitHub/web search (Brave/Tavily API)
- [ ] **Mini Book compression** — after ingesting repos, auto-generate compressed wisdom
- [ ] **LLMOps analytics** — token usage, cost, latency per backend in Ops mode
- [ ] **Systemd service** — auto-start on Linux login

### Low Priority
- [ ] **Better UI/UX** — find top starred dashboard UI repos, repurpose design
- [ ] **Google Drive sync** — connect Drive folder to library
- [ ] **PageIndex RAG** — vectorless TypeScript RAG to replace keyword classifier
- [ ] **LangGraph approval gates** — stateful human-in-the-loop for High/Critical tasks

---

## Architecture

```
LIBRARY-MCP/
├── builderbrain/
│   ├── src/
│   │   ├── api/index.ts          ← Hono REST API (port 8765)
│   │   ├── cli/index.ts          ← Commander CLI (brain ...)
│   │   ├── mcp/index.ts          ← MCP server skeleton
│   │   ├── engines/
│   │   │   ├── classifier.ts     ← 14-domain keyword classifier
│   │   │   ├── bookRouter.ts     ← selects books per domain
│   │   │   ├── riskConfidence.ts ← risk/confidence scorer
│   │   │   ├── contextPackBuilder.ts
│   │   │   ├── proposalEngine.ts
│   │   │   └── aiRouter.ts       ← multi-AI backend router
│   │   ├── config/manager.ts     ← config.json load/save
│   │   └── memory/
│   │       ├── selfLearning.ts
│   │       └── userStyle.ts
│   ├── dashboard/src/
│   │   ├── App.tsx               ← 6-mode React dashboard
│   │   ├── api.ts                ← typed API client
│   │   └── styles.css            ← dark theme (#0f1117 + #7c3aed)
│   ├── brain-data/
│   │   ├── library/              ← 20 knowledge books (markdown)
│   │   │   ├── pocket-rules/     ← always included (4 files)
│   │   │   ├── mini-book/        ← domain wisdom (6 files)
│   │   │   ├── self-learning/    ← auto-updated lessons (6 files)
│   │   │   └── user-style/       ← personality/rules (4 files)
│   │   ├── big-bible/repos/      ← cloned GitHub repos ← NEW
│   │   ├── runs/                 ← JSON run logs
│   │   └── config.json           ← API keys (gitignored)
│   └── tests/                    ← 34 Vitest tests (all passing)
├── LaunchBrain.sh                ← Linux launcher
├── LaunchBrain.command           ← macOS launcher
└── LaunchBrain.bat               ← Windows launcher
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | `{ok:true, version:"2.0.0"}` |
| GET | `/status` | books, runs, lessons, categories |
| GET | `/books` | list all library books |
| GET | `/book?path=` | read a book's content |
| GET | `/runs?limit=` | recent run logs |
| POST | `/context` | build context pack for a task |
| POST | `/propose` | generate proposal with risk assessment |
| POST | `/chat` | chat with BuilderBrain (auto-clones repos) |
| POST | `/learn` | save a lesson to self-learning memory |
| GET | `/config` | get config (keys masked) |
| POST | `/config` | save config |
| POST | `/repo/clone` | clone a GitHub repo to library |
| GET | `/repos` | list all cloned repos |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 22+ |
| Language | TypeScript 5.5+ |
| Backend | Hono 4.x |
| Frontend | React 18 + Vite 5 |
| AI Routing | Custom multi-backend fetch router |
| Tests | Vitest |
| Sandbox | bubblewrap (planned) |
| Search | Brave/Tavily API (planned) |
| Alerts | Telegram/Slack webhooks (planned) |
