import React, { useState, useEffect, useRef } from 'react'
import { api, ChatMessage, RunLog, Config, AIBackend } from './api'

type Mode = 'agent' | 'chat' | 'library' | 'ops' | 'settings'

function riskClass(level: string) {
  const l = level?.toLowerCase()
  if (l === 'critical') return 'badge-critical'
  if (l === 'high') return 'badge-high'
  if (l === 'medium') return 'badge-medium'
  return 'badge-low'
}

// ── Agent Mode ──────────────────────────────────────────────────────────────
function AgentMode({ status }: { status: any }) {
  return (
    <div className="agent-hero">
      <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
      <h1>BuilderBrain Agent Mode</h1>
      <p>
        Agent mode runs silently in the background. Connect any MCP-compatible
        coding agent and BuilderBrain will inject context before every task.
      </p>
      <div className="code-block">
        <div className="comment"># Add to your MCP client config (claude_code_config.json)</div>
        {`{
  "mcpServers": {
    "builderbrain": {
      "command": "brain",
      "args": ["mcp"]
    }
  }
}`}
        <br />
        <div className="comment"># Or connect via HTTP</div>
        {`curl http://localhost:8765/status`}
      </div>
      {status && (
        <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="stat-card" style={{ minWidth: 120 }}>
            <div className="stat-label">Books</div>
            <div className="stat-value">{status.books}</div>
          </div>
          <div className="stat-card" style={{ minWidth: 120 }}>
            <div className="stat-label">Runs</div>
            <div className="stat-value">{status.runs}</div>
          </div>
          <div className="stat-card" style={{ minWidth: 120 }}>
            <div className="stat-label">Status</div>
            <div className="stat-value" style={{ fontSize: 14, marginTop: 4 }}>
              <span className="badge badge-low">● {status.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat Mode ────────────────────────────────────────────────────────────────
function ChatMode({ onMetaUpdate }: { onMetaUpdate: (meta: any) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await api.chat(next, messages.length === 0 ? text : undefined)
      setMessages([...next, { role: 'assistant', content: res.text }])
      if (messages.length === 0) {
        try {
          const ctx: any = await api.context(text)
          onMetaUpdate({ ...ctx, backend: res.backend, model: res.model, tokens: res.tokens })
        } catch {}
      }
    } catch (e: any) {
      setMessages([...next, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span style={{ fontSize: 22 }}>🧠</span>
        <h2>BuilderBrain Chat</h2>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Your library is the context
        </span>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div style={{ fontSize: 48 }}>🧠</div>
            <h2>What are we building today?</h2>
            <p style={{ fontSize: 13 }}>
              Ask anything. I'll answer using your knowledge library — not the internet.
              <br />First message triggers a context pack from your books.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              {['Build a LinkedIn automation', 'How do I implement JWT refresh?', 'Best practices for TypeScript APIs', 'Add video generation stack'].map(s => (
                <button key={s} className="btn btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.filter(m => m.role !== 'system').map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-avatar">{m.role === 'user' ? '👤' : '🧠'}</div>
            <div>
              <div className="msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-avatar">🧠</div>
            <div className="msg-bubble">
              <div className="typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-area">
        <div className="warning-banner">
          ⚠️ LOCAL ONLY — No authentication. Do not expose port 8765 to the internet.
        </div>
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
          />
          <button className="btn btn-primary btn-icon" onClick={send} disabled={loading || !input.trim()}>
            {loading ? <span className="spinner" /> : '▶'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Library Mode ─────────────────────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  'pocket-rules': '📌',
  'mini-book': '📖',
  'self-learning': '🧠',
  'user-style': '🎨',
}

function LibraryMode() {
  const [books, setBooks] = useState<Record<string, string[]>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({ 'pocket-rules': true, 'mini-book': true })
  const [selected, setSelected] = useState<{ cat: string; file: string } | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.books().then(setBooks).catch(() => {}) }, [])

  const openFile = async (cat: string, file: string) => {
    setSelected({ cat, file })
    setLoading(true)
    try {
      const res = await api.book(`${cat}/${file}`)
      setContent(res.content)
    } catch { setContent('Failed to load book.') }
    finally { setLoading(false) }
  }

  if (selected) {
    return (
      <div className="book-viewer">
        <button className="back-btn" onClick={() => setSelected(null)}>← Back to Library</button>
        <h1>{CAT_ICONS[selected.cat] ?? '📄'} {selected.file}</h1>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          {selected.cat}/{selected.file}
        </div>
        {loading ? <div className="empty"><span className="spinner" /></div>
          : <div className="book-content">{content}</div>}
      </div>
    )
  }

  return (
    <div className="library-container">
      <h2>📚 Knowledge Library</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Your Obsidian-compatible knowledge vault. Click any book to read.
      </p>
      {Object.entries(books).map(([cat, files]) => (
        <div key={cat} className="lib-category">
          <div className="lib-category-header" onClick={() => setOpen(o => ({ ...o, [cat]: !o[cat] }))}>
            <span>{CAT_ICONS[cat] ?? '📁'}</span>
            <span>{cat}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{files.length} files</span>
            <span style={{ color: 'var(--text-muted)' }}>{open[cat] ? '▼' : '▶'}</span>
          </div>
          {open[cat] && files.map(f => (
            <div key={f} className="lib-file" onClick={() => openFile(cat, f)}>
              <span>📄</span> {f}
            </div>
          ))}
        </div>
      ))}
      {Object.keys(books).length === 0 && (
        <div className="empty">Library is empty. Run <code>brain init</code> to initialize.</div>
      )}
    </div>
  )
}

// ── Ops Mode ─────────────────────────────────────────────────────────────────
function OpsMode({ status }: { status: any }) {
  const [runs, setRuns] = useState<RunLog[]>([])

  useEffect(() => { api.runs(20).then(setRuns).catch(() => {}) }, [])

  return (
    <div className="ops-container">
      <h2>📊 Operations</h2>
      {status && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card"><div className="stat-label">Books</div><div className="stat-value">{status.books}</div></div>
          <div className="stat-card"><div className="stat-label">Runs</div><div className="stat-value">{status.runs}</div></div>
          <div className="stat-card"><div className="stat-label">Lessons</div><div className="stat-value">{status.hasPriorLessons ? '✓' : '—'}</div></div>
          <div className="stat-card"><div className="stat-label">Version</div><div className="stat-value" style={{ fontSize: 14, marginTop: 6 }}>{status.version}</div></div>
        </div>
      )}
      <h3 style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Library Categories
      </h3>
      {status?.categories && (
        <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(status.categories).map(([cat, count]) => (
            <div key={cat} className="card" style={{ padding: '10px 14px', margin: 0 }}>
              <div className="card-title">{cat}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{count as number} books</div>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Recent Runs
      </h3>
      {runs.length === 0 && <div className="empty">No runs yet. Use the CLI or Chat mode.</div>}
      {runs.map(r => (
        <div key={r.id} className="run-item">
          <div className="run-item-header">
            <span className="run-command">brain {r.command}</span>
            <span className={`badge ${riskClass(r.risk)}`}>{r.risk}</span>
            <span className="badge badge-blue">{r.confidence}</span>
            {r.detectedDomains?.length > 0 && (
              <div className="tags" style={{ marginLeft: 'auto' }}>
                {r.detectedDomains.slice(0, 3).map(d => <span key={d} className="tag">{d}</span>)}
              </div>
            )}
          </div>
          <div className="run-summary">{r.summary}</div>
          <div className="run-meta">{new Date(r.timestamp).toLocaleString()} · {r.booksUsed?.length ?? 0} books</div>
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
    name: '', type: 'openai-compatible', endpoint: '', apiKey: '', model: 'gpt-4-turbo', priority: 1, enabled: true,
  })

  useEffect(() => { api.getConfig().then(setConfig).catch(() => {}) }, [])

  const save = async () => {
    if (!config) return
    setSaving(true)
    try { await api.saveConfig(config); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch {}
    finally { setSaving(false) }
  }

  const addBackend = () => {
    if (!config || !newBackend.name) return
    const backend: AIBackend = {
      name: newBackend.name!, type: newBackend.type as any ?? 'openai-compatible',
      endpoint: newBackend.endpoint, apiKey: newBackend.apiKey,
      model: newBackend.model ?? 'gpt-4-turbo',
      priority: (config.ai_backends.length + 1), enabled: true,
    }
    setConfig({ ...config, ai_backends: [...config.ai_backends, backend] })
    setNewBackend({ name: '', type: 'openai-compatible', endpoint: '', apiKey: '', model: 'gpt-4-turbo', priority: 1, enabled: true })
  }

  const removeBackend = (name: string) => {
    if (!config) return
    setConfig({ ...config, ai_backends: config.ai_backends.filter(b => b.name !== name) })
  }

  const toggleBackend = (name: string) => {
    if (!config) return
    setConfig({ ...config, ai_backends: config.ai_backends.map(b => b.name === name ? { ...b, enabled: !b.enabled } : b) })
  }

  if (!config) return <div className="empty"><span className="spinner" /></div>

  return (
    <div className="settings-container">
      <h2>⚙️ Settings</h2>
      <div className="warning-banner">
        ⚠️ API keys are stored locally in brain-data/config.json (gitignored). Never commit this file.
      </div>

      <h3 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>AI Backends</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
        Add 5+ OpenAI-compatible backends. BuilderBrain tries them in priority order — never stops.
      </p>

      {config.ai_backends.map(b => (
        <div key={b.name} className="backend-card">
          <div className="backend-card-header">
            <span className="backend-name">🔌 {b.name}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="toggle">
                <input type="checkbox" checked={b.enabled} onChange={() => toggleBackend(b.name)} />
                <span className="slider" />
              </label>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => removeBackend(b.name)}>Remove</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <div>Type: {b.type} · Model: {b.model ?? 'default'} · Priority: {b.priority}</div>
            {b.endpoint && <div>Endpoint: {b.endpoint}</div>}
            {b.apiKey && <div>Key: {b.apiKey}</div>}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>+ Add AI Backend</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="my-openai" value={newBackend.name}
              onChange={e => setNewBackend(n => ({ ...n, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={newBackend.type}
              onChange={e => setNewBackend(n => ({ ...n, type: e.target.value as any }))}>
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="local">Local (Ollama)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">API Key</label>
            <input className="form-input" type="password" placeholder="sk-..." value={newBackend.apiKey}
              onChange={e => setNewBackend(n => ({ ...n, apiKey: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Model</label>
            <input className="form-input" placeholder="gpt-4-turbo" value={newBackend.model}
              onChange={e => setNewBackend(n => ({ ...n, model: e.target.value }))} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Endpoint (for custom/local APIs)</label>
            <input className="form-input" placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
              value={newBackend.endpoint}
              onChange={e => setNewBackend(n => ({ ...n, endpoint: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={addBackend} disabled={!newBackend.name}>
          Add Backend
        </button>
      </div>

      <div className="form-group" style={{ marginTop: 20 }}>
        <label className="form-label">Fallback Strategy</label>
        <select className="form-select" value={config.fallback_strategy}
          onChange={e => setConfig({ ...config, fallback_strategy: e.target.value as any })}>
          <option value="smart-fallback">Smart Fallback (primary first, fallback on error)</option>
          <option value="round-robin">Round Robin (cycle through all)</option>
          <option value="load-balance">Load Balance (distribute requests)</option>
        </select>
      </div>

      <h3 style={{ marginBottom: 12, marginTop: 20, fontSize: 13, fontWeight: 600 }}>Alerts</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Telegram Bot Token</label>
          <input className="form-input" type="password" placeholder="1234567890:ABC..."
            value={config.alerts?.telegram_bot_token ?? ''}
            onChange={e => setConfig({ ...config, alerts: { ...config.alerts, telegram_bot_token: e.target.value } })} />
        </div>
        <div className="form-group">
          <label className="form-label">Telegram Chat ID</label>
          <input className="form-input" placeholder="-1001234567890"
            value={config.alerts?.telegram_chat_id ?? ''}
            onChange={e => setConfig({ ...config, alerts: { ...config.alerts, telegram_chat_id: e.target.value } })} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Slack Webhook URL</label>
          <input className="form-input" placeholder="https://hooks.slack.com/services/..."
            value={config.alerts?.slack_webhook ?? ''}
            onChange={e => setConfig({ ...config, alerts: { ...config.alerts, slack_webhook: e.target.value } })} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}

// ── Metadata Panel ────────────────────────────────────────────────────────────
function MetaPanel({ meta }: { meta: any }) {
  if (!meta) return (
    <div className="right-panel">
      <h3>Context</h3>
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Send a message to see context pack details.
      </div>
    </div>
  )
  return (
    <div className="right-panel">
      <h3>Context Pack</h3>
      {meta.risk && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Risk</div>
          <span className={`badge ${riskClass(meta.risk?.level)}`}>
            {meta.risk?.level} ({meta.risk?.score}/100)
          </span>
        </div>
      )}
      {meta.confidence && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Confidence</div>
          <span className="badge badge-blue">{meta.confidence?.level} ({meta.confidence?.score}/100)</span>
        </div>
      )}
      {meta.detectedDomains?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Domains</div>
          <div className="tags">{meta.detectedDomains.map((d: string) => <span key={d} className="tag">{d}</span>)}</div>
        </div>
      )}
      {meta.bookStack?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Books Used ({meta.bookStack.length})</div>
          {meta.bookStack.map((b: any) => (
            <div key={b.path} style={{ fontSize: 11, color: 'var(--text)', padding: '2px 0' }}>📄 {b.label}</div>
          ))}
        </div>
      )}
      {meta.backend && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>AI Backend</div>
          <div style={{ fontSize: 12 }}>{meta.backend}</div>
          {meta.model && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.model}</div>}
          {meta.tokens && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.tokens} tokens</div>}
        </div>
      )}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState<Mode>('agent')
  const [status, setStatus] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)

  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  const modes: Array<{ id: Mode; icon: string; label: string }> = [
    { id: 'agent', icon: '⚡', label: 'Agent' },
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'library', icon: '📚', label: 'Library' },
    { id: 'ops', icon: '📊', label: 'Ops' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  const showRightPanel = mode === 'chat' || mode === 'agent'

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <span>🧠</span> BuilderBrain
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">Modes</div>
          {modes.map(m => (
            <button key={m.id} className={`mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}>
              <span className="icon">{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
        <div className="sidebar-divider" />
        {status && (
          <div className="sidebar-section">
            <div className="sidebar-label">System</div>
            <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
              <div>📚 {status.books} books</div>
              <div>🔄 {status.runs} runs</div>
              <div>✓ v{status.version}</div>
            </div>
          </div>
        )}
        <div className="sidebar-bottom">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px' }}>
            localhost:8765 · Local only
          </div>
        </div>
      </div>

      <div className="main">
        <div className="content">
          {mode === 'agent' && <AgentMode status={status} />}
          {mode === 'chat' && <ChatMode onMetaUpdate={setMeta} />}
          {mode === 'library' && <LibraryMode />}
          {mode === 'ops' && <OpsMode status={status} />}
          {mode === 'settings' && <SettingsMode />}
        </div>
        {showRightPanel && <MetaPanel meta={meta} />}
      </div>
    </div>
  )
}
