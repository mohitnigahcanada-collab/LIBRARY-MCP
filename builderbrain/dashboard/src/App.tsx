import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api, type ChatMessage, type StatusResponse, type RunLog, type Config, type AIBackend } from './api'

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
        <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"args": ["/path/to/builderbrain/dist/mcp/index.js"]</div>
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
}

function riskColor(level: string) {
  const map: Record<string, string> = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' }
  return map[level] ?? 'badge-blue'
}

function ChatMode() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [activeTask, setActiveTask] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<ContextMeta | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Fetch context if task is active
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
        } catch { /* ignore context errors */ }
      }

      const response = await api.chat(newMessages, activeTask)
      setMessages([...newMessages, { role: 'assistant', content: response.text }])
      setMeta({ domains, risk, confidence, books, backend: response.backend, model: response.model, tokens: response.tokens })
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, activeTask])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const setTask = () => {
    setActiveTask(taskInput.trim() || undefined)
    setMeta(null)
  }

  return (
    <>
      <div className="content chat-container">
        <div className="chat-header">
          <span style={{ fontSize: 20 }}>💬</span>
          <h2>Chat with BuilderBrain</h2>
          {activeTask && (
            <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>
              📌 {activeTask.slice(0, 40)}{activeTask.length > 40 ? '…' : ''}
            </span>
          )}
        </div>

        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Set task context (optional) — e.g. 'build auth system'"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setTask()}
          />
          <button className="btn btn-ghost" onClick={setTask}>Set</button>
          {activeTask && (
            <button className="btn btn-ghost" onClick={() => { setActiveTask(undefined); setTaskInput(''); setMeta(null) }}>Clear</button>
          )}
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div style={{ fontSize: 48 }}>🧠</div>
              <h2>Ask your library anything</h2>
              <p>Set a task context above to get domain-aware responses from your knowledge library.</p>
            </div>
          )}

          {messages.filter((m) => m.role !== 'system').map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              <div className="msg-avatar">
                {msg.role === 'user' ? '👤' : '🧠'}
              </div>
              <div>
                <div className="msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg assistant">
              <div className="msg-avatar">🧠</div>
              <div className="msg-bubble typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={send}
              disabled={loading || !input.trim()}
              title="Send"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      <div className="right-panel">
        <h3>Context</h3>
        {!meta && (
          <div className="empty" style={{ padding: 16 }}>Send a message to see context metadata</div>
        )}
        {meta && (
          <>
            {meta.domains.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>DOMAINS</div>
                <div className="tags">
                  {meta.domains.map((d) => <span key={d} className="tag">{d}</span>)}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>RISK</div>
              <span className={`badge ${riskColor(meta.risk.level)}`}>{meta.risk.level} ({meta.risk.score}/100)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>CONFIDENCE</div>
              <span className={`badge badge-blue`}>{meta.confidence.level} ({meta.confidence.score}/100)</span>
            </div>
            {meta.books.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BOOKS LOADED</div>
                {meta.books.map((b) => (
                  <div key={b} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>📖 {b}</div>
                ))}
              </div>
            )}
            {meta.backend && meta.backend !== 'none' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BACKEND</div>
                <div style={{ fontSize: 12 }}>{meta.backend}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.model}{meta.tokens ? ` · ${meta.tokens} tokens` : ''}</div>
              </div>
            )}
          </>
        )}
        {messages.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => { setMessages([]); setMeta(null) }}
          >
            Clear Chat
          </button>
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [bookContent, setBookContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.books().then((b) => {
      setBooks(b)
      // Expand all by default
      const exp: Record<string, boolean> = {}
      Object.keys(b).forEach((k) => { exp[k] = true })
      setExpanded(exp)
    }).catch(() => {})
  }, [])

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

  return (
    <div className="content library-container">
      <h2>📚 Library</h2>
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
      {Object.keys(books).length === 0 && (
        <div className="empty">Loading library…</div>
      )}
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
