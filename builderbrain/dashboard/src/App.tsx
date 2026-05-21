import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api, type ChatMessage, type StatusResponse, type RunLog, type Config, type AIBackend, type RepoMetadata, type RepoDetails } from './api'

type Mode = 'agent' | 'chat' | 'research' | 'library' | 'ops' | 'settings'

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const modes: Array<{ id: Mode; icon: string; label: string }> = [
    { id: 'agent', icon: '🤖', label: 'Agent' },
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'research', icon: '🔍', label: 'Research' },
    { id: 'library', icon: '📚', label: 'Library' },
    { id: 'ops', icon: '📊', label: 'Ops' },
  ]
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span>🧠</span>
        <div>
          <div>BuilderBrain</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>v2.0.0</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Modes</div>
        {modes.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className="icon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-divider" />
        <button
          className={`mode-btn ${mode === 'settings' ? 'active' : ''}`}
          onClick={() => setMode('settings')}
        >
          <span className="icon">⚙️</span>
          Settings
        </button>
      </div>
    </div>
  )
}

// ── Agent Mode ────────────────────────────────────────────────────────────────

function AgentMode({ status }: { status: StatusResponse | null }) {
  return (
    <div className="content agent-hero">
      <h1>🤖 Agent Mode</h1>
      <p>
        Connect BuilderBrain as an MCP server to Claude Desktop or any MCP-compatible agent.
        Your library context powers every decision.
      </p>
      <div className="code-block">
        <div className="comment"># Add to Claude Desktop config:</div>
        <div>{'{'}</div>
        <div>&nbsp;&nbsp;"mcpServers": {'{'}</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;"builderbrain": {'{'}</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"command": "node",</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"args": ["/path/to/builderbrain/dist/mcp/server.js"]</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;{'}'}</div>
        <div>&nbsp;&nbsp;{'}'}</div>
        <div>{'}'}</div>
      </div>

      {status && (
        <div style={{ marginTop: 32, width: '100%', maxWidth: 560 }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Books</div>
              <div className="stat-value">{status.books}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Runs</div>
              <div className="stat-value">{status.runs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Prior Lessons</div>
              <div className="stat-value">{status.hasPriorLessons ? '✓' : '–'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Status</div>
              <div className="stat-value" style={{ fontSize: 14, color: 'var(--green)' }}>● Online</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat Mode ─────────────────────────────────────────────────────────────────

interface ContextMeta {
  domains: string[]
  risk: { level: string; score: number }
  confidence: { level: string; score: number }
  books: string[]
  backend?: string
  model?: string
  tokens?: number
  ensembleMembers?: Array<{
    backend: string
    model: string
    ok: boolean
    tokens?: number
    error?: string
    text: string
  }>
}

interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  timestamp: number
}

function riskColor(level: string) {
  const map: Record<string, string> = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' }
  return map[level] ?? 'badge-blue'
}

function loadConversations(): Conversation[] {
  try { return JSON.parse(localStorage.getItem('bb_conversations') ?? '[]') } catch { return [] }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem('bb_conversations', JSON.stringify(convs.slice(0, 50)))
}

function ChatMode() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [activeTask, setActiveTask] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<ContextMeta | null>(null)
  const [ensembleEnabled, setEnsembleEnabled] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const newChat = () => {
    setActiveId(null)
    setMessages([])
    setMeta(null)
    setTaskInput('')
    setActiveTask(undefined)
  }

  const loadConversation = (conv: Conversation) => {
    setActiveId(conv.id)
    setMessages(conv.messages)
    setMeta(null)
  }

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    saveConversations(updated)
    if (activeId === id) newChat()
  }

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      let domains: string[] = []
      let risk = { level: 'Low', score: 0 }
      let confidence = { level: 'High', score: 100 }
      let books: string[] = []

      if (activeTask) {
        try {
          const ctx = await api.context(activeTask) as any
          domains = ctx.detectedDomains ?? []
          risk = ctx.risk ?? risk
          confidence = ctx.confidence ?? confidence
          books = (ctx.bookStack ?? []).map((b: any) => b.label)
        } catch { /* ignore */ }
      }

      const requestConversationId = activeId ?? `conv_${Date.now()}`
      const response = await api.chat(newMessages, activeTask, requestConversationId, {
        ensemble: ensembleEnabled,
        ensembleCount: 3,
      })
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: response.text }]
      setMessages(finalMessages)
      setMeta({
        domains,
        risk,
        confidence,
        books,
        backend: response.backend,
        model: response.model,
        tokens: response.tokens,
        ensembleMembers: response.ensemble?.members,
      })

      // Persist to conversation history
      const title = userMsg.content.slice(0, 60)
      const id = response.conversationId ?? requestConversationId
      const conv: Conversation = { id, title, messages: finalMessages, timestamp: Date.now() }
      const updated = [conv, ...conversations.filter((c) => c.id !== id)]
      setConversations(updated)
      saveConversations(updated)
      setActiveId(id)
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, activeTask, activeId, conversations, ensembleEnabled])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* History sidebar */}
      <div style={{ width: 200, minWidth: 200, background: 'var(--sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 10px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} onClick={newChat}>+ New Chat</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {conversations.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 4px', textAlign: 'center' }}>No history yet</div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv)}
              style={{
                padding: '7px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                background: activeId === conv.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                border: activeId === conv.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                💬 {conv.title}
              </span>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                title="Delete"
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="content chat-container">
        <div className="chat-header">
          <span style={{ fontSize: 20 }}>💬</span>
          <h2>Chat with BuilderBrain</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={ensembleEnabled} onChange={(e) => setEnsembleEnabled(e.target.checked)} />
              3-AI Debate
            </label>
            <input
              className="form-input"
              style={{ width: 240, fontSize: 12 }}
              placeholder="Task context (optional)"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTask(taskInput.trim() || undefined), setMeta(null))}
            />
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => { setActiveTask(taskInput.trim() || undefined); setMeta(null) }}>Set</button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div style={{ fontSize: 48 }}>🧠</div>
              <h2>Your personal library AI</h2>
              <p style={{ maxWidth: 400 }}>Ask anything — coding patterns, repo recommendations, project planning. BuilderBrain answers from your library first.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500, marginTop: 8 }}>
                {['How do I structure a SaaS backend?', 'What JWT patterns do you know?', 'Suggest a video generation stack', 'Clone a trending repo for me'].map((s) => (
                  <button key={s} className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.filter((m) => m.role !== 'system').map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              <div className="msg-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
              <div>
                <div className="msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg assistant">
              <div className="msg-avatar">🧠</div>
              <div className="msg-bubble typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="btn btn-primary btn-icon" onClick={send} disabled={loading || !input.trim()} title="Send">↑</button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <h3>Context</h3>
        {!meta ? (
          <div className="empty" style={{ padding: 16 }}>Send a message to see context</div>
        ) : (
          <>
            {meta.domains.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>DOMAINS</div>
                <div className="tags">{meta.domains.map((d) => <span key={d} className="tag">{d}</span>)}</div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>RISK</div>
              <span className={`badge ${riskColor(meta.risk.level)}`}>{meta.risk.level} ({meta.risk.score}/100)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>CONFIDENCE</div>
              <span className="badge badge-blue">{meta.confidence.level} ({meta.confidence.score}/100)</span>
            </div>
            {meta.books.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BOOKS LOADED</div>
                {meta.books.map((b) => <div key={b} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>📖 {b}</div>)}
              </div>
            )}
            {meta.backend && meta.backend !== 'none' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BACKEND</div>
                <div style={{ fontSize: 12 }}>{meta.backend}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.model}{meta.tokens ? ` · ${meta.tokens} tokens` : ''}</div>
              </div>
            )}
            {meta.ensembleMembers && meta.ensembleMembers.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>DEBATE AGENTS</div>
                {meta.ensembleMembers.map((m) => (
                  <div key={`${m.backend}-${m.model}`} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 0' }}>
                      {m.ok ? '✓' : '✗'} {m.backend} · {m.model}{m.tokens ? ` · ${m.tokens}t` : ''}{m.error ? ` · ${m.error}` : ''}
                    </div>
                    {m.ok && m.text && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.9 }}>
                        {m.text.slice(0, 180)}{m.text.length > 180 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Research Mode ─────────────────────────────────────────────────────────────

function ResearchMode() {
  const [task, setTask] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setRMode] = useState<'context' | 'propose'>('context')

  const run = async () => {
    if (!task.trim() || loading) return
    setLoading(true)
    try {
      const r = mode === 'context' ? await api.context(task) : await api.propose(task)
      setResult(r)
    } catch (err) {
      setResult({ error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>🔍 Research</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${mode === 'context' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRMode('context')}>Context Pack</button>
        <button className={`btn ${mode === 'propose' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRMode('propose')}>Proposal</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder={mode === 'context' ? 'Describe your task to analyze...' : 'Describe what you want to build...'}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="btn btn-primary" onClick={run} disabled={loading || !task.trim()}>
          {loading ? <span className="spinner" /> : 'Analyze'}
        </button>
      </div>

      {result && (
        <div className="card">
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.6 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Library Mode ──────────────────────────────────────────────────────────────

function LibraryMode() {
  const [books, setBooks] = useState<Record<string, string[]>>({})
  const [repos, setRepos] = useState<RepoMetadata[]>([])
  const [selectedRepo, setSelectedRepo] = useState<RepoDetails | null>(null)
  const [repoUrl, setRepoUrl] = useState('')
  const [repoTopic, setRepoTopic] = useState('ai-agent-frameworks')
  const [seedFilePath, setSeedFilePath] = useState('')
  const [repoBusy, setRepoBusy] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [bookContent, setBookContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.books().then((b) => {
      setBooks(b)
      const exp: Record<string, boolean> = {}
      Object.keys(b).forEach((k) => { exp[k] = true })
      exp['big-bible'] = true
      setExpanded(exp)
    }).catch(() => {})
    api.repos().then(setRepos).catch(() => {})
  }, [])

  const refreshRepos = async () => {
    const list = await api.repos()
    setRepos(list)
  }

  const openBook = async (cat: string, file: string) => {
    const path = `${cat}/${file}`
    setSelected(path)
    setLoading(true)
    try {
      const r = await api.book(path)
      setBookContent(r.content)
    } catch {
      setBookContent('Failed to load book.')
    } finally {
      setLoading(false)
    }
  }

  const catIcons: Record<string, string> = {
    'pocket-rules': '📋',
    'mini-book': '📖',
    'self-learning': '🧠',
    'user-style': '👤',
  }

  if (selected && bookContent !== null) {
    return (
      <div className="content book-viewer">
        <button className="back-btn" onClick={() => { setSelected(null); setBookContent(null) }}>
          ← Back to Library
        </button>
        <h1>{selected.split('/').pop()?.replace('.md', '')}</h1>
        {loading ? <div className="spinner" /> : (
          <div className="book-content">{bookContent}</div>
        )}
      </div>
    )
  }

  if (selectedRepo) {
    const meta = selectedRepo.metadata
    return (
      <div className="content book-viewer">
        <button className="back-btn" onClick={() => setSelectedRepo(null)}>
          ← Back to Library
        </button>
        <h1>{meta.owner}/{meta.name}</h1>
        <div className="book-content">
          <p><b>Status:</b> {meta.status}</p>
          <p><b>Topic:</b> {meta.topic}</p>
          <p><b>Path:</b> {meta.localPath}</p>
          <p><b>Updated:</b> {new Date(meta.updatedAt).toLocaleString()}</p>
          <p><b>Risk:</b> {selectedRepo.risk?.riskLevel ?? 'n/a'} ({selectedRepo.risk?.riskScore ?? 0})</p>
          <p><b>Score:</b> {selectedRepo.score?.qualityScore ?? 'n/a'} / 100</p>
          <p><b>License:</b> {selectedRepo.license?.license ?? selectedRepo.score?.license ?? 'unknown'}</p>
          {selectedRepo.license?.warning && <p><b>License Warning:</b> {selectedRepo.license.warning}</p>}
          {selectedRepo.summaryPath && <p><b>Summary:</b> {selectedRepo.summaryPath}</p>}
          {selectedRepo.digestPath && <p><b>Digest:</b> {selectedRepo.digestPath}</p>}
          {selectedRepo.risk?.findings && selectedRepo.risk.findings.length > 0 && (
            <>
              <h3>Risk Findings</h3>
              {selectedRepo.risk.findings.slice(0, 20).map((f, idx) => (
                <div key={`${f.file}-${idx}`}>[{f.severity}] {f.file}: {f.message}</div>
              ))}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary" disabled={repoBusy} onClick={async () => {
            setRepoBusy(true)
            try {
              await api.analyzeRepo(meta.id)
              const detail = await api.repoDetails(meta.id)
              setSelectedRepo(detail)
              await refreshRepos()
            } finally {
              setRepoBusy(false)
            }
          }}>Analyze</button>
          <button className="btn btn-ghost" disabled={repoBusy} onClick={async () => {
            setRepoBusy(true)
            try {
              await api.digestRepo(meta.id)
              const detail = await api.repoDetails(meta.id)
              setSelectedRepo(detail)
            } finally {
              setRepoBusy(false)
            }
          }}>Digest</button>
          <button className="btn btn-ghost" disabled={repoBusy} onClick={async () => {
            setRepoBusy(true)
            try {
              await api.acceptRepo(meta.id)
              const detail = await api.repoDetails(meta.id)
              setSelectedRepo(detail)
              await refreshRepos()
            } finally {
              setRepoBusy(false)
            }
          }}>Accept</button>
        </div>
      </div>
    )
  }

  return (
    <div className="content library-container">
      <h2>📚 Library</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 320 }}
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="topic"
            value={repoTopic}
            onChange={(e) => setRepoTopic(e.target.value)}
          />
          <button className="btn btn-primary" disabled={!repoUrl.trim() || repoBusy} onClick={async () => {
            setRepoBusy(true)
            try {
              await api.addRepo(repoUrl.trim(), repoTopic.trim() || 'general')
              setRepoUrl('')
              await refreshRepos()
            } finally {
              setRepoBusy(false)
            }
          }}>
            + Add Repo
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="/absolute/path/to/repos.md"
            value={seedFilePath}
            onChange={(e) => setSeedFilePath(e.target.value)}
          />
          <button className="btn btn-ghost" disabled={!seedFilePath.trim() || repoBusy} onClick={async () => {
            setRepoBusy(true)
            try {
              await api.importMarkdown({ filePath: seedFilePath.trim(), topic: repoTopic.trim() || 'general', autoAnalyze: true })
              await refreshRepos()
            } finally {
              setRepoBusy(false)
            }
          }}>
            Import MD
          </button>
        </div>
      </div>
      {Object.entries(books).map(([cat, files]) => (
        <div key={cat} className="lib-category">
          <div
            className="lib-category-header"
            onClick={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
          >
            <span>{expanded[cat] ? '▾' : '▸'}</span>
            <span>{catIcons[cat] ?? '📁'}</span>
            <span>{cat}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{files.length} files</span>
          </div>
          {expanded[cat] && files.map((file) => (
            <div
              key={file}
              className={`lib-file ${selected === `${cat}/${file}` ? 'active' : ''}`}
              onClick={() => openBook(cat, file)}
            >
              <span>📄</span>
              {file.replace('.md', '')}
            </div>
          ))}
        </div>
      ))}

      {/* Repo intelligence section */}
      <div className="lib-category">
        <div
          className="lib-category-header"
          onClick={() => setExpanded((prev) => ({ ...prev, 'big-bible': !prev['big-bible'] }))}
        >
          <span>{expanded['big-bible'] ? '▾' : '▸'}</span>
          <span>🗄️</span>
          <span>big-bible / repos</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{repos.length} repos</span>
        </div>
        {expanded['big-bible'] && repos.length === 0 && (
          <div style={{ padding: '6px 24px', fontSize: 12, color: 'var(--text-muted)' }}>
            No repos yet. Add a GitHub URL above.
          </div>
        )}
        {expanded['big-bible'] && repos.map((repo) => (
          <div key={repo.id} className="lib-file" onClick={async () => {
            setRepoBusy(true)
            try {
              const detail = await api.repoDetails(repo.id)
              setSelectedRepo(detail)
            } finally {
              setRepoBusy(false)
            }
          }}>
            <span>📦</span>
            {repo.id}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: repo.status === 'accepted' ? 'var(--green)' : 'var(--text-muted)' }}>
              {repo.status}
            </span>
          </div>
        ))}
      </div>

      {Object.keys(books).length === 0 && <div className="empty">Loading library…</div>}
    </div>
  )
}

// ── Ops Mode ──────────────────────────────────────────────────────────────────

function OpsMode({ status }: { status: StatusResponse | null }) {
  const [runs, setRuns] = useState<RunLog[]>([])

  useEffect(() => {
    api.runs(20).then(setRuns).catch(() => {})
  }, [])

  const riskBadge = (r: string) => {
    const map: Record<string, string> = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' }
    return map[r] ?? 'badge-blue'
  }

  return (
    <div className="content ops-container">
      <h2>📊 Ops</h2>

      {status && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Books</div>
            <div className="stat-value">{status.books}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Runs</div>
            <div className="stat-value">{status.runs}</div>
          </div>
          {Object.entries(status.categories).map(([cat, count]) => (
            <div key={cat} className="stat-card">
              <div className="stat-label">{cat}</div>
              <div className="stat-value">{count}</div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>Recent Runs</h3>
      {runs.length === 0 && <div className="empty">No runs yet</div>}
      {runs.map((run) => (
        <div key={run.id} className="run-item">
          <div className="run-item-header">
            <span className="run-command">{run.command}</span>
            <span className={`badge ${riskBadge(run.risk)}`}>{run.risk}</span>
            {run.detectedDomains.slice(0, 2).map((d) => (
              <span key={d} className="tag">{d}</span>
            ))}
          </div>
          <div className="run-summary">{run.summary}</div>
          <div className="run-meta">{new Date(run.timestamp).toLocaleString()} · {run.booksUsed.length} books</div>
        </div>
      ))}
    </div>
  )
}

// ── Settings Mode ─────────────────────────────────────────────────────────────

function SettingsMode() {
  const [config, setConfig] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newBackend, setNewBackend] = useState<Partial<AIBackend>>({
    name: '', type: 'openai', model: 'gpt-4-turbo', priority: 1, enabled: true
  })
  const [addingBackend, setAddingBackend] = useState(false)

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {})
  }, [])

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await api.saveConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const addBackend = async () => {
    if (!newBackend.name || !config) return
    const backend: AIBackend = {
      name: newBackend.name!,
      type: (newBackend.type as AIBackend['type']) ?? 'openai',
      endpoint: newBackend.endpoint,
      apiKey: newBackend.apiKey,
      model: newBackend.model ?? 'gpt-4-turbo',
      priority: newBackend.priority ?? 1,
      enabled: true,
    }
    const updated = { ...config, ai_backends: [...config.ai_backends, backend] }
    setConfig(updated)
    setSaving(true)
    try {
      await api.saveConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
      setAddingBackend(false)
      setNewBackend({ name: '', type: 'openai', model: 'gpt-4-turbo', priority: 1, enabled: true })
    }
  }

  const removeBackend = (name: string) => {
    if (!config) return
    setConfig({ ...config, ai_backends: config.ai_backends.filter((b) => b.name !== name) })
  }

  const toggleBackend = (name: string) => {
    if (!config) return
    setConfig({
      ...config,
      ai_backends: config.ai_backends.map((b) =>
        b.name === name ? { ...b, enabled: !b.enabled } : b
      )
    })
  }

  if (!config) return <div className="content" style={{ padding: 20 }}><div className="spinner" /></div>

  return (
    <div className="content settings-container">
      <h2>⚙️ Settings</h2>

      <div className="warning-banner">
        ⚠️ API keys are stored locally in brain-data/config.json — never committed to git.
      </div>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)' }}>AI Backends</h3>

        {config.ai_backends.length === 0 && (
          <div className="empty" style={{ padding: 20 }}>No AI backends configured. Add one below.</div>
        )}

        {config.ai_backends.map((b) => (
          <div key={b.name} className="backend-card">
            <div className="backend-card-header">
              <div>
                <div className="backend-name">{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.type} · {b.model}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="toggle">
                  <input type="checkbox" checked={b.enabled} onChange={() => toggleBackend(b.name)} />
                  <span className="slider" />
                </label>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => removeBackend(b.name)}>Remove</button>
              </div>
            </div>
            {b.apiKey && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                Key: {b.apiKey}
              </div>
            )}
            {b.endpoint && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                Endpoint: {b.endpoint}
              </div>
            )}
          </div>
        ))}

        {!addingBackend ? (
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setAddingBackend(true)}>
            + Add Backend
          </button>
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>New Backend</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g. OpenAI GPT-4" value={newBackend.name ?? ''} onChange={(e) => setNewBackend({ ...newBackend, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={newBackend.type ?? 'openai'} onChange={(e) => setNewBackend({ ...newBackend, type: e.target.value as any })}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai-compatible">OpenAI-Compatible</option>
                <option value="local">Local</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input className="form-input" type="password" placeholder="sk-..." value={newBackend.apiKey ?? ''} onChange={(e) => setNewBackend({ ...newBackend, apiKey: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input className="form-input" placeholder="gpt-4-turbo" value={newBackend.model ?? ''} onChange={(e) => setNewBackend({ ...newBackend, model: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint (optional)</label>
              <input className="form-input" placeholder="https://api.openai.com/v1" value={newBackend.endpoint ?? ''} onChange={(e) => setNewBackend({ ...newBackend, endpoint: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Priority (lower = first)</label>
              <input className="form-input" type="number" min={1} value={newBackend.priority ?? 1} onChange={(e) => setNewBackend({ ...newBackend, priority: Number(e.target.value) })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={addBackend}>Save Backend</button>
              <button className="btn btn-ghost" onClick={() => setAddingBackend(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)' }}>General</h3>
        <div className="form-group">
          <label className="form-label">Fallback Strategy</label>
          <select
            className="form-select"
            value={config.fallback_strategy}
            onChange={(e) => setConfig({ ...config, fallback_strategy: e.target.value as Config['fallback_strategy'] })}
          >
            <option value="smart-fallback">Smart Fallback</option>
            <option value="round-robin">Round Robin</option>
            <option value="load-balance">Load Balance</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Server Port</label>
          <input
            className="form-input"
            type="number"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Library Folder Override</label>
          <input
            className="form-input"
            placeholder="/path/to/library"
            value={config.library_path_override ?? ''}
            onChange={(e) => setConfig({ ...config, library_path_override: e.target.value || undefined })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Warehouse Folder Override</label>
          <input
            className="form-input"
            placeholder="/path/to/warehouse"
            value={config.warehouse_path_override ?? ''}
            onChange={(e) => setConfig({ ...config, warehouse_path_override: e.target.value || undefined })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">3-AI Debate Enabled</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={Boolean(config.ensemble_enabled)}
              onChange={(e) => setConfig({ ...config, ensemble_enabled: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Debate Agent Count</label>
          <input
            className="form-input"
            type="number"
            min={2}
            max={3}
            value={config.ensemble_agent_count ?? 3}
            onChange={(e) => setConfig({ ...config, ensemble_agent_count: Number(e.target.value) })}
          />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)' }}>Auto GitHub Expansion</h3>
        <div className="form-group">
          <label className="form-label">Enabled</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={Boolean(config.auto_expand?.enabled)}
              onChange={(e) => setConfig({
                ...config,
                auto_expand: {
                  enabled: e.target.checked,
                  interval_minutes: config.auto_expand?.interval_minutes ?? 180,
                  categories: config.auto_expand?.categories ?? ['ai-agent-frameworks'],
                  most_starred: config.auto_expand?.most_starred ?? 10,
                  fresh: config.auto_expand?.fresh ?? 5,
                  safe: config.auto_expand?.safe ?? true,
                },
              })}
            />
            <span className="slider" />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Interval Minutes</label>
          <input
            className="form-input"
            type="number"
            min={15}
            value={config.auto_expand?.interval_minutes ?? 180}
            onChange={(e) => setConfig({
              ...config,
              auto_expand: {
                enabled: config.auto_expand?.enabled ?? false,
                categories: config.auto_expand?.categories ?? ['ai-agent-frameworks'],
                most_starred: config.auto_expand?.most_starred ?? 10,
                fresh: config.auto_expand?.fresh ?? 5,
                safe: config.auto_expand?.safe ?? true,
                interval_minutes: Number(e.target.value),
              },
            })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Categories (comma-separated)</label>
          <input
            className="form-input"
            value={(config.auto_expand?.categories ?? ['ai-agent-frameworks']).join(',')}
            onChange={(e) => setConfig({
              ...config,
              auto_expand: {
                enabled: config.auto_expand?.enabled ?? false,
                interval_minutes: config.auto_expand?.interval_minutes ?? 180,
                most_starred: config.auto_expand?.most_starred ?? 10,
                fresh: config.auto_expand?.fresh ?? 5,
                safe: config.auto_expand?.safe ?? true,
                categories: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              },
            })}
          />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)' }}>Alerts</h3>
        <div className="form-group">
          <label className="form-label">Slack Webhook URL</label>
          <input
            className="form-input"
            placeholder="https://hooks.slack.com/..."
            value={config.alerts.slack_webhook ?? ''}
            onChange={(e) => setConfig({ ...config, alerts: { ...config.alerts, slack_webhook: e.target.value } })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Telegram Bot Token</label>
          <input
            className="form-input"
            type="password"
            placeholder="123456:ABC..."
            value={config.alerts.telegram_bot_token ?? ''}
            onChange={(e) => setConfig({ ...config, alerts: { ...config.alerts, telegram_bot_token: e.target.value } })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Telegram Chat ID</label>
          <input
            className="form-input"
            placeholder="-1001234567890"
            value={config.alerts.telegram_chat_id ?? ''}
            onChange={(e) => setConfig({ ...config, alerts: { ...config.alerts, telegram_chat_id: e.target.value } })}
          />
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const r = await fetch('/alert/test', { method: 'POST' }).then(r => r.json()).catch(() => null)
            alert(r ? `Telegram: ${r.telegram ? '✅' : '❌'}  Slack: ${r.slack ? '✅' : '❌'}` : 'Failed to reach server')
          }}
        >
          Test Alerts
        </button>
      </section>

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? <span className="spinner" /> : saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<Mode>('agent')
  const [status, setStatus] = useState<StatusResponse | null>(null)

  useEffect(() => {
    api.status().then(setStatus).catch(() => {})
    const interval = setInterval(() => {
      api.status().then(setStatus).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app">
      <Sidebar mode={mode} setMode={setMode} />
      <div className="main">
        {mode === 'agent' && <AgentMode status={status} />}
        {mode === 'chat' && <ChatMode />}
        {mode === 'research' && <ResearchMode />}
        {mode === 'library' && <LibraryMode />}
        {mode === 'ops' && <OpsMode status={status} />}
        {mode === 'settings' && <SettingsMode />}
      </div>
    </div>
  )
}
