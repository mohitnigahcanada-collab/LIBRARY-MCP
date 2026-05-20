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
  alerts: Record<string, string>
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
  chat: (messages: ChatMessage[], task?: string) => post<ChatResponse>('/chat', { messages, task }),
  getConfig: () => get<Config>('/config'),
  saveConfig: (config: Partial<Config>) => post<{ success: boolean }>('/config', config),
  learn: (lesson: { task: string; problem: string; rootCause: string; solution: string; evidence: string }) =>
    post<{ success: boolean }>('/learn', lesson),
  cloneRepo: (url: string) => post<{ success: boolean; repoName: string; path: string; message: string }>('/repo/clone', { url }),
  repos: () => get<Array<{ name: string; path: string }>>('/repos'),
}
