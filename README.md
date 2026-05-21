# LIBRARY-MCP

**BuilderBrain** — Your Local-First Personal AI Engineering Brain

A powerful, private, local-first AI assistant that runs entirely on your machine. It combines a rich personal knowledge library with intelligent agents, multi-AI chat, automatic repo cloning, and MCP (Model Context Protocol) support.

## 🚀 What is BuilderBrain?

BuilderBrain is like having a **super-smart coding partner and personal librarian** living on your laptop.

It knows your personal "books" (curated knowledge, rules, past lessons, and your working style). When you give it a task, it:

- Classifies the task across 14 domains
- Picks the most relevant knowledge from your library
- Assesses risk and confidence
- Builds rich context packs for other AIs (Claude, Cursor, etc.)
- Can **automatically clone GitHub repositories** when you mention them in chat
- Learns from every interaction and remembers how *you* like to work

One app. One port (`http://localhost:8765`). Multiple powerful modes.

## ✨ Key Features

- **🧠 Intelligent Context Engine** — 14-domain classifier + book router + risk scorer
- **📚 Personal Knowledge Library** — 20+ seeded books across pocket-rules, mini-books, self-learning, and user-style
- **💬 Smart Multi-AI Chat** — Strong persistent system prompt, auto repo cloning, suggestion chips
- **🤖 Agentic Workflows** — Proposal engine with approval gates, self-learning memory
- **🖥️ Beautiful React Dashboard** — 6 modes: Agent · Chat · Research · Library · Ops · Settings
- **🔌 MCP Ready** — Exposes tools via Model Context Protocol skeleton
- **📥 One-Click Repo Cloning** — Paste a GitHub URL in chat → it clones automatically
- **🚀 Cross-Platform Launchers** — One-click start on Windows, macOS, Linux
- **🔒 Fully Local & Private** — Your data never leaves your machine (API keys stored locally)

## 🏃 Quick Start

### One-Click Launch (Recommended)

```bash
# Clone the repo
git clone https://github.com/mohitnigahcanada-collab/LIBRARY-MCP.git
cd LIBRARY-MCP

# Linux / Arch / CachyOS
chmod +x LaunchBrain.sh
./LaunchBrain.sh

# macOS
# Double-click LaunchBrain.command

# Windows
# Double-click LaunchBrain.bat
```

### Manual Start

```bash
cd builderbrain
npm install
npm run build:all
npm start
```

Then open **http://localhost:8765**

## 🧭 The 6 Modes

| Mode       | What it does                                      |
|------------|---------------------------------------------------|
| **Agent**  | Task proposals, context packs, risk assessment    |
| **Chat**   | Natural conversation with full library context + auto-cloning |
| **Research** | (Coming soon) Web + GitHub search               |
| **Library**  | Browse and manage your knowledge books + cloned repos |
| **Ops**    | Logs, analytics, backend management               |
| **Settings** | Configure API keys, preferences                 |

## 🏗️ Architecture Overview

```
LIBRARY-MCP/
├── builderbrain/
│   ├── src/
│   │   ├── api/          # Hono REST API (port 8765)
│   │   ├── cli/          # `brain` command line tool
│   │   ├── engines/      # classifier, bookRouter, risk, context, proposal, aiRouter
│   │   ├── memory/       # self-learning + user style
│   │   └── mcp/          # Model Context Protocol tools
│   ├── dashboard/        # React + Vite frontend
│   └── brain-data/       # Your private library + cloned repos + logs
├── LaunchBrain.*         # Cross-platform launchers
└── PROGRESS.md           # Detailed development log
```

## 🔌 MCP Tools (Current)

- `brain_context_pack`
- `brain_propose`
- `brain_save_lesson`
- `brain_status`

More coming as the project evolves.

## 📡 API Highlights

| Endpoint          | Method | Description                     |
|-------------------|--------|---------------------------------|
| `/health`         | GET    | Health check                    |
| `/status`         | GET    | Books, runs, lessons stats      |
| `/context`        | POST   | Build rich context pack         |
| `/propose`        | POST   | Generate task proposal + risk   |
| `/chat`           | POST   | Chat with auto repo cloning     |
| `/repo/clone`     | POST   | Manually clone a GitHub repo    |
| `/learn`          | POST   | Save a lesson to memory         |

Full details in `PROGRESS.md`

## 🛠️ Tech Stack

- **Backend**: TypeScript, Hono, Node.js
- **Frontend**: React + Vite + Tailwind (dark theme)
- **AI**: Vercel AI SDK (supports OpenAI, Anthropic, and any OpenAI-compatible provider)
- **Testing**: Vitest (34 tests passing)
- **CLI**: Commander.js
- **MCP**: Custom skeleton (expanding)

## 🔮 Roadmap (High Priority)

- Daily trend radar + Telegram alerts
- Task queue system with execution
- Real Research mode (Brave/Tavily)
- Library mode improvements (show cloned repos)
- Auto repo analysis after cloning
- Better RAG (PageIndex or vector)
- Systemd service for auto-start

See `PROGRESS.md` for the full living roadmap.

## 🤝 Contributing

This is currently a personal project, but ideas and improvements are welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes (keep tests passing)
4. Open a Pull Request

## 📄 License

Currently unlicensed (personal project). Feel free to reach out if you'd like to discuss.

## 🙏 Credits & Inspiration

Built with ❤️ by Mohit Nigah  
Inspired by the new Model Context Protocol (MCP), local-first AI movement, and the desire for a truly personal coding brain that remembers *you*.

---

**Ready to build smarter?** Start the brain and say hello at `http://localhost:8765`
