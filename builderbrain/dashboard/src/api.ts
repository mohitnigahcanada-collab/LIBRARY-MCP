const BASE = import.meta.env.DEV ? '/api' : ''

export interface StatusResponse {
  version: string
  status: string
  books: number
  runs: number
  hasPriorLessons: boolean
  categories: Record<string, number>
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  text: string
  backend: string
  model: string
  tokens?: number
  conversationId?: string
  ensemble?: {
    strategy: string
    members: Array<{
      backend: string
      model: string
      ok: boolean
      tokens?: number
      error?: string
      text: string
    }>
  }
}

export interface RepoMetadata {
  id: string
  owner: string
  name: string
  url: string
  topic: string
  status: string
  localPath: string
  updatedAt: string
}

export interface RepoDetails {
  metadata: RepoMetadata
  risk?: { riskLevel?: string; riskScore?: number; findings?: Array<{ file: string; message: string; severity: string }> }
  score?: { qualityScore?: number; learningValueScore?: number; finalVerdict?: string; license?: string }
  license?: { license?: string; licenseRisk?: string; warning?: string }
  summaryPath?: string | null
  digestPath?: string | null
}

export interface RunLog {
  id: string
  timestamp: string
  command: string
  input: string
  detectedDomains: string[]
  booksUsed: string[]
  risk: string
  confidence: string
  summary: string
}

export interface AIBackend {
  name: string
  type: string
  endpoint?: string
  apiKey?: string
  model?: string
  priority: number
  enabled: boolean
}

export interface Config {
  ai_backends: AIBackend[]
  fallback_strategy: string
  port: number
  library_path_override?: string
  warehouse_path_override?: string
  ensemble_enabled?: boolean
  ensemble_agent_count?: number
  alerts: Record<string, string>
  auto_expand?: {
    enabled: boolean
    interval_minutes: number
    categories: string[]
    most_starred: number
    fresh: number
    safe: boolean
    target_books_min: number
    cycle_repo_budget: number
    use_ai_curation: boolean
  }
  daily_trends: {
    enabled: boolean
    search_apis: string[]
    schedule_time: string
    filter_min_stars: number
    max_repos_per_day: number
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export const api = {
  status: () => get<StatusResponse>('/status'),
  books: () => get<Record<string, string[]>>('/books'),
  book: (path: string) => get<{ path: string; content: string }>(`/book?path=${encodeURIComponent(path)}`),
  runs: (limit = 20) => get<RunLog[]>(`/runs?limit=${limit}`),
  context: (task: string) => post<unknown>('/context', { task }),
  propose: (task: string) => post<unknown>('/propose', { task }),
  chat: (
    messages: ChatMessage[],
    task?: string,
    conversationId?: string,
    options?: { ensemble?: boolean; ensembleCount?: number; ensembleBackends?: string[] }
  ) => post<ChatResponse>('/chat', { messages, task, conversationId, ...options }),
  getConfig: () => get<Config>('/config'),
  saveConfig: (config: Partial<Config>) => post<{ success: boolean }>('/config', config),
  learn: (lesson: { task: string; problem: string; rootCause: string; solution: string; evidence: string }) =>
    post<{ success: boolean }>('/learn', lesson),
  cloneRepo: (url: string, topic?: string) => post<{ success: boolean; repoId: string; repoName: string; message: string }>('/repo/clone', { url, topic }),
  repos: () => get<RepoMetadata[]>('/repos'),
  addRepo: (url: string, topic?: string) => post<{ success: boolean; repoId: string; message: string }>('/repos/add', { url, topic }),
  repoDetails: (id: string) => get<RepoDetails>(`/repos/${encodeURIComponent(id)}`),
  analyzeRepo: (id: string) => post<{ success: boolean; message: string }>(`/repos/${encodeURIComponent(id)}/analyze`, {}),
  scoreRepo: (id: string) => post<unknown>(`/repos/${encodeURIComponent(id)}/score`, {}),
  digestRepo: (id: string) => post<{ success: boolean; message: string }>(`/repos/${encodeURIComponent(id)}/digest`, {}),
  acceptRepo: (id: string) => post<{ success: boolean; message: string }>(`/repos/${encodeURIComponent(id)}/accept`, {}),
  importMarkdown: (payload: { markdown?: string; filePath?: string; topic?: string; autoAnalyze?: boolean }) =>
    post<{ success: boolean; message: string; imported: string[]; failed: Array<{ url: string; error: string }> }>('/library/import-markdown', payload),
  autoExpandStatus: () => get<{
    enabled: boolean
    intervalMinutes: number
    targetBooksMin: number
    currentMiniBooks: number
    lastRunAt: string | null
    lastSummary: string
  }>('/library/auto-expand/status'),
  runAutoExpandNow: () => post<unknown>('/library/auto-expand/run', {}),
}
